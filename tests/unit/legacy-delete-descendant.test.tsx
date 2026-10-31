import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reconcileDeleted } from "../../src/cloud/deletion-reconcile";
import { deliverQueue } from "../../src/cloud/delivery";
import { recordDelivery } from "../../src/cloud/journal";
import { cloudData } from "../../src/cloud/types";
import { deleteTask, editTask } from "../../src/domain/task-actions";
import type { WorkspaceData } from "../../src/domain/types";
import { validateWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
import { setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";
const fixture = async (dirty: boolean) => {
  const initial = await setup();
  await initial.store.change((data) => {
    data.operations = [];
    deleteTask(data, "PMON-900001");
    data.remote.push({
      ...structuredClone(data.remote[1]!),
      id: "PMON-900003",
      parentId: "PMON-900001",
      summary: "Legacy cached descendant",
    });
    editTask(data, "PMON-900002", { summary: "Independent edit" });
    if (dirty) {
      editTask(data, "PMON-900003", { description: "Preserve child notes" });
      data.commentDrafts["PMON-900003"] = "Preserve comment";
    }
    data.cloud = { ...cloudData(data), accountId: "synthetic-owner" };
    recordDelivery(data, data.operations[0]!.opId, {
      status: "conflict",
      message: "Legacy missing deletion target",
    });
  });
  const dir = await mkdtemp(join(tmpdir(), "romdex-legacy-descendant-")),
    file = join(dir, "record.json");
  await writeFile(
    file,
    JSON.stringify({ data: initial.store.getSnapshot().data, revision: 0 }),
  );
  const persistence = {
    load: async () => {
      const record = JSON.parse(await readFile(file, "utf8")) as {
        data: WorkspaceData;
        revision: number;
      };
      validateWorkspace(record.data);
      return record;
    },
    save: async (data: WorkspaceData, revision: number) => {
      const prior = await persistence.load();
      assert.equal(prior.revision, revision);
      await writeFile(file, JSON.stringify({ data, revision: revision + 1 }));
      return revision + 1;
    },
  };
  const store = new WorkspaceStore(persistence);
  await store.start();
  const before = structuredClone(store.getSnapshot().data),
    operation = before.operations[0]!;
  assert.equal(operation.type, "delete");
  if (operation.type !== "delete") throw Error("fixture");
  const transport = navigationPort(
    before.remote.filter(
      (item) => !["PMON-900001", "PMON-900003"].includes(item.id),
    ),
  );
  let deletes = 0;
  transport.port.remove = async () => {
    deletes++;
    throw Error("Unexpected DELETE");
  };
  const reconcile = () =>
    store.deliver((commit) =>
      reconcileDeleted(
        store.getSnapshot().data,
        operation,
        commit,
        transport.port,
      ).then(() => {}),
    );
  const run = () =>
    store.deliver((commit) =>
      deliverQueue(() => store.getSnapshot().data, commit, transport.port),
    );
  return {
    store,
    before,
    operation,
    persistence,
    reconcile,
    run,
    ...transport,
    deletes: () => deletes,
    cleanup: () => rm(dir, { recursive: true }),
  };
};
test("reopened legacy parent deletion retires independently from clean or dirty omitted descendants", async () => {
  for (const dirty of [false, true]) {
    const f = await fixture(dirty);
    try {
      await f.reconcile();
      const after = f.store.getSnapshot().data;
      assert.deepEqual(after.operations, f.before.operations.slice(1));
      assert.deepEqual(after.commentDrafts, f.before.commentDrafts);
      assert.deepEqual(
        after.remote.find((x) => x.id === "PMON-900003"),
        f.before.remote.find((x) => x.id === "PMON-900003"),
      );
      assert.deepEqual(cloudData(after).records[f.operation.opId]?.retiredIds, [
        "PMON-900001",
      ]);
      assert.deepEqual(
        cloudData(after).records[f.operation.opId]?.archivedOperation,
        f.operation,
      );
      assert.equal(f.deletes(), 0);
      const reopened = new WorkspaceStore(f.persistence);
      await reopened.start();
      assert.deepEqual(reopened.getSnapshot().data, after);
      if (dirty)
        await assert.rejects(
          f.run(),
          /no longer readable/i,
        );
      else await f.run();
      assert.ok(f.sent.includes("PMON-900002"));
      assert.equal(f.deletes(), 0);
      if (dirty) {
        assert.equal(f.store.getSnapshot().data.operations.length, 1);
        assert.equal(
          f.store.getSnapshot().data.commentDrafts["PMON-900003"],
          "Preserve comment",
        );
      } else {
        await f.run();
        assert.equal(f.store.getSnapshot().data.operations.length, 0);
        const child = f.before.remote.find((x) => x.id === "PMON-900003")!;
        f.remote.set(child.id, { ...child, parentId: null, updated: 2 });
        await f.store.applyIncoming(
          [...f.remote.values()],
          new Set(),
          () => {},
          true,
        );
        assert.equal(
          f.store.getSnapshot().data.remote.find((x) => x.id === child.id)
            ?.parentId,
          null,
        );
        assert.equal(f.deletes(), 0);
      }
    } finally {
      await f.cleanup();
    }
  }
});
test("unreadable child with failed or inconsistent full membership never acknowledges parent", async () => {
  for (const mode of [
    "401",
    "403",
    "network",
    "page",
    "present",
    "duplicate",
  ]) {
    const f = await fixture(true);
    try {
      f.port.deletionState = async (id) => ({
        item: await f.port.get(id),
        gone: id === f.operation.issueId,
      });
      const all = f.port.all;
      f.port.all = async () => {
        if (mode === "401" || mode === "403")
          throw new YouTrackHttpError(Number(mode));
        if (mode === "network" || mode === "page")
          throw Error("Synthetic incomplete snapshot");
        const items = await all();
        return mode === "present"
          ? [...items, f.before.remote.find((x) => x.id === "PMON-900003")!]
          : [...items, items[0]!];
      };
      await assert.rejects(f.reconcile());
      assert.deepEqual(f.store.getSnapshot().data, f.before);
      assert.equal(f.deletes(), 0);
      assert.deepEqual(f.sent, []);
    } finally {
      await f.cleanup();
    }
  }
});
