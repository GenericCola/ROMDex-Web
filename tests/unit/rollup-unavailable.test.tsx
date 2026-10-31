import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  readRecoveryUploads,
  recoveryWithUploads,
  stageRecoveryUploads,
} from "../../src/attachments/recovery";
import type { StoredUpload, UploadStore } from "../../src/attachments/types";
import { planRollup } from "../../src/cloud/rollup";
import { readRollupTree } from "../../src/cloud/rollup-tree";
import { cloudData } from "../../src/cloud/types";
import { deferredStatusChanged } from "../../src/cloud/unavailable-tasks";
import { validateWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
import { setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";
const fixture = async () => {
  const { store } = await setup();
  await store.change((data) => {
    data.operations = [];
    data.cloud = {
      autoSync: true,
      accountId: "synthetic-owner",
      records: {},
      rollupPending: true,
    };
  });
  return { store, ...navigationPort(store.getSnapshot().data.remote) };
};
test("unavailable clean standalone cache is archived, not a global status failure; restoration returns it", async () => {
  const f = await fixture();
  const item = {
    ...f.store.getSnapshot().data.remote[0]!,
    id: "PMON-900099",
    parentId: null,
  };
  await f.store.change((data) => {
    data.remote.push(item);
  });
  await f.store.deliver((commit) =>
    planRollup(() => f.store.getSnapshot().data, commit, f.port).then(() => {}),
  );
  let data = f.store.getSnapshot().data;
  assert.ok(!data.remote.some((x) => x.id === item.id));
  assert.deepEqual(data.cloud?.unavailable?.tasks, [item]);
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, []);
  validateWorkspace(structuredClone(data));
  f.remote.set(item.id, item);
  await f.store.deliver((commit) =>
    planRollup(() => f.store.getSnapshot().data, commit, f.port).then(() => {}),
  );
  data = f.store.getSnapshot().data;
  assert.ok(data.remote.some((x) => x.id === item.id));
  assert.equal(data.cloud?.unavailable, undefined);
});
test("full-snapshot removal retires a cached child without retaining false parent dependencies", async () => {
  const f = await fixture();
  f.remote.delete("PMON-900001");
  const result = await readRollupTree(structuredClone(f.store.getSnapshot().data), f.port);
  assert.deepEqual(result.blockedIds, []);
  assert.ok(!result.items.some((x) => x.id === "PMON-900001"));
  assert.ok(result.unavailable.some((x) => x.id === "PMON-900001"));
  await f.store.deliver((commit) => planRollup(() => f.store.getSnapshot().data, commit, f.port).then(() => {}));
  assert.equal(deferredStatusChanged(f.store.getSnapshot().data), false);
});
test("malformed or failed full snapshots never replace cached data", async () => {
  const f = await fixture(); const original = f.port.all;
  for (const error of [new YouTrackHttpError(401), new YouTrackHttpError(403), Error("page two failed")]) {
    f.port.all = async () => { throw error; };
    const before = JSON.stringify(f.store.getSnapshot().data);
    await assert.rejects(readRollupTree(structuredClone(f.store.getSnapshot().data), f.port));
    assert.equal(JSON.stringify(f.store.getSnapshot().data), before);
  }
  f.port.all = async () => [...await original(), (await original())[0]!];
  await assert.rejects(readRollupTree(structuredClone(f.store.getSnapshot().data), f.port), /duplicate/i);
});
test("legacy cancelled deletion is not proof; tombstones are and local drafts stay recoverable", async () => {
  const f = await fixture();
  const item = {
    ...f.store.getSnapshot().data.remote[0]!,
    id: "PMON-900099",
    parentId: null,
  };
  await f.store.change((data) => {
    data.remote.push(item);
    data.commentDrafts[item.id] = "keep draft";
    cloudData(data).records.old = {
      status: "confirmed",
      message: "Remaining deletion explicitly stopped",
      archivedOperation: {
        type: "delete",
        opId: "old",
        issueId: item.id,
        ids: [item.id],
      },
    };
  });
  let result = await readRollupTree(
    structuredClone(f.store.getSnapshot().data),
    f.port,
  );
  assert.ok(result.items.some((x) => x.id === item.id));
  assert.ok(result.unavailable.some((x) => x.id === item.id));
  await f.store.change((data) => {
    delete data.commentDrafts[item.id];
    cloudData(data).records.old!.deletedIds = [item.id];
  });
  result = await readRollupTree(
    structuredClone(f.store.getSnapshot().data),
    f.port,
  );
  assert.ok(!result.items.some((x) => x.id === item.id));
});
test("fresh visible orphan preserves its actual parent without fabricating old links", async () => {
  const f = await fixture(); const child = f.remote.get("PMON-900001")!;
  child.parentId = "PMON-900099";
  const result = await readRollupTree(structuredClone(f.store.getSnapshot().data), f.port);
  assert.equal(result.items.find((x) => x.id === child.id)?.parentId, "PMON-900099");
  assert.ok(!result.blockedIds.includes(child.id));
});

test("unlisted live child prevents false Done while an independent complete parent can update", async () => {
  const f = await fixture();
  for (const id of ["PMON-900001", "PMON-900002"])
    f.remote.get(id)!.state = "Done";
  const root = {
    ...f.remote.get("PMON-900000")!,
    id: "PMON-900010",
    parentId: null,
  };
  const child = {
    ...f.remote.get("PMON-900001")!,
    id: "PMON-900011",
    parentId: root.id,
    state: "Done",
    assignedState: "Done",
  };
  f.remote.set(root.id, root);
  f.remote.set(child.id, child);
  const children = f.port.children;
  f.port.children = async (id) =>
    id === "PMON-900000"
      ? ["PMON-900001", "PMON-900002", "PMON-900099"]
      : children(id);
  const result = await readRollupTree(
    structuredClone(f.store.getSnapshot().data),
    f.port,
  );
  assert.notEqual(result.next?.id, "PMON-900000");
  assert.equal(result.next?.id, root.id);
  assert.ok(result.blockedIds.includes("PMON-900000"));
  assert.ok(result.missingIds.includes("PMON-900099"));
});
test("unavailable history validation rejects foreign scopes and malformed imported history", async () => {
  const f = await fixture();
  const data = structuredClone(f.store.getSnapshot().data);
  data.cloud!.unavailable = {
    accountId: "another-user",
    project: "PMON",
    tasks: [],
    missingIds: [],
    blockedIds: [],
    fingerprint: "",
  };
  assert.throws(() => validateWorkspace(data), /workspace/);
  data.cloud!.unavailable.accountId = "synthetic-owner";
  data.cloud!.unavailable.missingIds = ["PMON-1", "PMON-1"];
  assert.throws(() => validateWorkspace(data), /identifiers/);
});

test("an unavailable task with an unfulfilled local status choice never becomes falsely clean", async () => {
  const f = await fixture();
  const item = {
    ...f.store.getSnapshot().data.remote[0]!,
    id: "PMON-900099",
    parentId: null,
  };
  await f.store.change((data) => {
    data.remote.push(item);
    data.cloud!.assigned = {
      [item.id]: {
        assignedState: "Done",
        lastState: "To do",
        lastUpdated: 1,
        pendingState: null,
      },
    };
  });
  const result = await readRollupTree(
    structuredClone(f.store.getSnapshot().data),
    f.port,
  );
  assert.ok(result.items.some((x) => x.id === item.id));
  assert.ok(result.blockedIds.includes(item.id));
  assert.notEqual(result.next?.id, item.id);
});

test("unavailable/deferred history survives disk serialization, recovery export and reopen with queued file bytes and drafts", async () => {
  const f = await fixture();
  f.remote.delete("PMON-900001");
  const archived = {
    ...f.store.getSnapshot().data.remote[0]!,
    id: "PMON-900099",
    parentId: null,
    description: "Retained unavailable notes",
  };
  await f.store.change((data) => {
    data.remote.push(archived);
  });
  await f.store.deliver((commit) =>
    planRollup(() => f.store.getSnapshot().data, commit, f.port).then(() => {}),
  );
  const id = "11111111-1111-4111-8111-111111111111",
    bytes = new TextEncoder().encode("keep exact attachment bytes");
  const file = {
    name: "kept.txt",
    size: bytes.length,
    mimeType: "text/plain",
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
  await f.store.change((data) => {
    data.operations.push({
      type: "attachment",
      opId: id,
      uploadId: id,
      issueId: "PMON-900002",
      file,
    });
    data.operations.push({
      type: "comment",
      opId: "comment-kept",
      issueId: "PMON-900002",
      text: "pending comment",
      created: 1,
    });
    data.titleDrafts["PMON-900002"] = "Keep title draft";
    data.commentDrafts["PMON-900002"] = "Keep comment draft";
    data.order["PMON-900002"] = 4;
    data.cloud!.unavailable!.linkedMissingIds = ["PMON-900199"];
    data.cloud!.unavailable!.missingIds.push("PMON-900199");
    data.cloud!.unavailable!.blockedIds = ["PMON-900000"];
  });
  const source = new Map<string, StoredUpload>([
    [id, { id, file, blob: new Blob([bytes]) }],
  ]);
  const storage = (map: Map<string, StoredUpload>): UploadStore => ({
    get: async (key) => map.get(key),
    put: async (value) => {
      map.set(value.id, value);
    },
    remove: async (key) => {
      map.delete(key);
    },
  });
  const exported = JSON.parse(
    await recoveryWithUploads(f.store.recover(), storage(source)),
  );
  assert.equal(exported.missingUploads.length, 0);
  assert.equal(exported.uploads.length, 1);
  const restored = validateWorkspace(exported.data);
  const files = await readRecoveryUploads(exported.uploads, restored);
  const target = new Map<string, StoredUpload>();
  await stageRecoveryUploads(files, storage(target));
  const folder = await mkdtemp(join(tmpdir(), "romdex-unavailable-reopen-"));
  try {
    const path = join(folder, "workspace.json");
    let revision = 0;
    await writeFile(path, JSON.stringify({ data: restored, revision }));
    const persistence = {
      load: async () => JSON.parse(await readFile(path, "utf8")),
      save: async (data: typeof restored, expected: number) => {
        assert.equal(expected, revision);
        revision++;
        await writeFile(path, JSON.stringify({ data, revision }));
        return revision;
      },
    };
    const first = new WorkspaceStore(persistence);
    await first.start();
    await first.change((data) => {
      data.view.search = "reopen proof";
    });
    await first.flush();
    const reopened = new WorkspaceStore(persistence);
    await reopened.start();
    const data = reopened.getSnapshot().data;
    assert.deepEqual(data.cloud?.unavailable, restored.cloud?.unavailable);
    assert.deepEqual(data.operations, restored.operations);
    assert.deepEqual(data.titleDrafts, restored.titleDrafts);
    assert.deepEqual(data.commentDrafts, restored.commentDrafts);
    assert.deepEqual(data.order, restored.order);
    assert.equal(data.view.search, "reopen proof");
    assert.equal(
      await target.get(id)!.blob.text(),
      "keep exact attachment bytes",
    );
    assert.ok(
      data.cloud?.unavailable?.tasks.some(
        (x) => x.id === archived.id && x.description === archived.description,
      ),
    );
    assert.deepEqual(data.cloud?.unavailable?.linkedMissingIds, ["PMON-900199"]);
    assert.ok(data.cloud?.unavailable?.blockedIds.includes("PMON-900000"));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
