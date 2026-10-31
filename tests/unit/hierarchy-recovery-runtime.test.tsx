import assert from "node:assert/strict";
import { test } from "node:test";
import { recoveryMode } from "../../src/auth/recovery-mode";
import {
  exitHierarchyRecovery,
  readHierarchyRecovery,
  repairHierarchyRecovery,
} from "../../src/cloud/hierarchy-recovery";
import { automaticDelivery, deliveryConnected } from "../../src/cloud/session";
import { workspaceStore } from "../../src/domain/workspace-store";

import { setAuthSession } from "../../src/auth/session";
import { deliverQueue } from "../../src/cloud/delivery";
import { disconnectDelivery } from "../../src/cloud/session";
import {
  applyHierarchyRecovery,
  previewHierarchyRecovery,
} from "../../src/domain/hierarchy-recovery";
import type { TaskItem, TaskPatch } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { navigationPort } from "../fixtures/navigation-port";
const task = (id: string, parentId: string | null = null): TaskItem => ({
  id,
  summary: "Original " + id,
  parentId,
  description: "Keep notes",
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Epic",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const hierarchyFixture = () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    originalFetch = globalThis.fetch;
  let href = "https://fixture.invalid/?recovery=1",
    replaced = "",
    reads = 0,
    writes = 0,
    user = "2-2",
    serverParent: string | null = null;
  let pauseDuringReplace: boolean | undefined;
  let failSave = false;
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        get href() {
          return href;
        },
        replace(value: string) {
          replaced = value;
          pauseDuringReplace = recoveryMode();
          // Browser navigation is asynchronous: the old URL can still render.
        },
      },
      history: {
        replaceState(_data: unknown, _title: string, url: string) {
          href = new URL(url, href).href;
        },
      },
      sessionStorage: {
        setItem(k: string, v: string) {
          storage.set(k, v);
        },
        getItem(k: string) {
          return storage.get(k) ?? null;
        },
        removeItem(k: string) {
          storage.delete(k);
        },
      },
    },
  });
  globalThis.fetch = (input, init) => {
    if ((init?.method ?? "GET") !== "GET") {
      writes++;
      throw Error("Fixture forbids HTTP writes");
    }
    reads++;
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    if (path === "/api/users/me")
      return Promise.resolve(
        Response.json({ id: user, login: "fixture", guest: false }),
      );
    if (path === "/api/admin/projects")
      return Promise.resolve(
        Response.json([{ id: "p", shortName: "PMON", name: "Synthetic PMON" }]),
      );
    if (path === "/api/issues")
      return Promise.resolve(
        Response.json(
          [1, 2, 3].map((n) => ({
            id: "raw-" + n,
            idReadable: "PMON-" + n,
            summary: "Server " + n,
            description: "Server notes",
            updated: 2,
            project: { shortName: "PMON" },
            parent: {
              issues:
                n === 1 && serverParent ? [{ idReadable: serverParent }] : [],
            },
          })),
        ),
      );
    throw Error("Unexpected synthetic read " + path);
  };
  const setup = async (uncertain = false) => {
    disconnectDelivery();
    href = "https://fixture.invalid/?recovery=1";
    replaced = "";
    storage.clear();
    user = "2-2";
    serverParent = null;
    failSave = false;
    setAuthSession({
      token: "fixture-no-access",
      userId: "2-2",
      projectId: "p",
      expiresAt: Date.now() + 60000,
    });
    const data = emptyWorkspace();
    data.remote = [task("PMON-1"), task("PMON-2"), task("PMON-3", "PMON-2")];
    data.operations = [
      {
        opId: "mixed",
        type: "edit",
        issueId: "PMON-1",
        base: task("PMON-1"),
        patch: { parentId: "PMON-2", summary: "Keep local title" },
      },
      {
        opId: "comment",
        type: "comment",
        issueId: "PMON-2",
        text: "Keep queued comment",
        created: 1,
      },
    ];
    data.commentDrafts.keep = "Keep draft";
    data.order = { "PMON-1": 9, "PMON-2": 3, "PMON-3": 1 };
    data.cloud = {
      autoSync: true,
      accountId: "2-2",
      records: uncertain
        ? { mixed: { status: "uncertain", message: "Unknown outcome" } }
        : {},
    };
    let revision = 0;
    await workspaceStore.switchPersistence({
      load: () => Promise.resolve({ data, revision }),
      save: () =>
        failSave
          ? Promise.reject(Error("Synthetic persistence failure"))
          : Promise.resolve(++revision),
    });
    return structuredClone(data);
  };
  return {
    setup,
    storage,
    get reads() {
      return reads;
    },
    get writes() {
      return writes;
    },
    get replaced() {
      return replaced;
    },
    get pauseDuringReplace() {
      return pauseDuringReplace;
    },
    setUser: (value: string) => {
      user = value;
    },
    setServerParent: (value: string | null) => {
      serverParent = value;
    },
    failSave: () => {
      failSave = true;
    },
    dispose: () => {
      disconnectDelivery();
      setAuthSession(null);
      globalThis.fetch = originalFetch;
      if (originalWindow)
        Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    },
  };
};

void test("hierarchy recovery runtime is selective, GET-only, preserves work and exits safely", async (t) => {
  const h = hierarchyFixture();
  const { setup, storage } = h;
  try {
    await t.test(
      "preview has no mutations; selective repair preserves all unrelated work and backs up",
      async () => {
        const before = await setup();
        const preview = await readHierarchyRecovery();
        assert.equal(preview.items.length, 2);
        assert.deepEqual(workspaceStore.getSnapshot().data, before);
        await repairHierarchyRecovery(preview, ["mixed"]);
        const after = workspaceStore.getSnapshot().data;
        assert.deepEqual(
          after.operations[0]?.type === "edit" && after.operations[0].patch,
          { summary: "Keep local title" },
        );
        assert.deepEqual(after.operations[1], before.operations[1]);
        assert.deepEqual(after.commentDrafts, before.commentDrafts);
        assert.deepEqual(after.order, before.order);
        assert.deepEqual(after.remote, before.remote);
        assert.equal(after.hierarchyRecovery?.length, 1);
        assert.match(
          JSON.stringify(after.hierarchyRecovery),
          /parentId.*PMON-2/,
        );
        assert.equal(recoveryMode(), true);
        assert.equal(deliveryConnected(), false);
        await assert.rejects(exitHierarchyRecovery(), /remaining hierarchy/);
        const remaining = await readHierarchyRecovery();
        await repairHierarchyRecovery(remaining, ["remote:PMON-3"]);
        const refreshed = workspaceStore.getSnapshot().data;
        assert.equal(refreshed.remote[2]?.parentId, null);
        assert.equal(refreshed.remote[2]?.description, "Keep notes");
        assert.equal(refreshed.remote[2]?.summary, "Original PMON-3");
        await exitHierarchyRecovery();
        await automaticDelivery();
        assert.equal(workspaceStore.getSnapshot().data.cloud?.autoSync, false);
        assert.equal(workspaceStore.getSnapshot().data.operations.length, 2);
        assert.deepEqual(workspaceStore.getSnapshot().data.order, before.order);
        assert.equal(h.replaced, "/?recovery=complete");
        assert.equal(recoveryMode(), false);
        assert.equal(h.pauseDuringReplace, false);
        assert.equal(storage.get("romdex-recovery-paused"), undefined);
        assert.equal(deliveryConnected(), false);
      },
    );
    await t.test(
      "uncertain operation cannot be repaired or exited",
      async () => {
        const before = await setup(true),
          preview = await readHierarchyRecovery();
        assert.match(preview.items[0]?.blockedReason ?? "", /uncertain/i);
        await assert.rejects(
          repairHierarchyRecovery(preview, ["mixed"]),
          /uncertain/i,
        );
        await assert.rejects(
          exitHierarchyRecovery(),
          /remaining hierarchy|uncertain/i,
        );
        assert.deepEqual(workspaceStore.getSnapshot().data, before);
        assert.equal(recoveryMode(), true);
      },
    );
    await t.test(
      "changed server rejects stale preview without modifying workspace",
      async () => {
        const before = await setup(),
          preview = await readHierarchyRecovery();
        h.setServerParent("PMON-2");
        await assert.rejects(
          repairHierarchyRecovery(preview, ["mixed"]),
          /Server hierarchy or workspace changed/,
        );
        assert.deepEqual(workspaceStore.getSnapshot().data, before);
      },
    );
    await t.test("wrong identity rejects before hierarchy read", async () => {
      const before = await setup();
      h.setUser("other");
      await assert.rejects(readHierarchyRecovery(), /affected PMON account/);
      assert.deepEqual(workspaceStore.getSnapshot().data, before);
    });
    await t.test(
      "persistence failure cannot clear pause or navigate out",
      async () => {
        await setup();
        const preview = await readHierarchyRecovery();
        await repairHierarchyRecovery(
          preview,
          preview.items.map((item) => item.id),
        );
        h.failSave();
        await assert.rejects(exitHierarchyRecovery(), /persistence failure/);
        assert.equal(recoveryMode(), true);
        assert.equal(h.replaced, "");
        assert.equal(storage.get("romdex-recovery-paused"), "1");
      },
    );
    assert.ok(h.reads > 0);
    assert.equal(h.writes, 0);
  } finally {
    h.dispose();
  }
});

void test("archived parent patch cannot re-enter later delivery after selective hierarchy repair", async () => {
  const item: TaskItem = {
    id: "PMON-1",
    summary: "Original title",
    parentId: null,
    description: "Keep notes",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Epic",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
  const parent: TaskItem = { ...item, id: "PMON-2", summary: "Parent" };
  const data = emptyWorkspace();
  data.remote = [item, parent];
  const mixed = {
    opId: "mixed",
    type: "edit" as const,
    issueId: item.id,
    base: structuredClone(item),
    patch: { parentId: parent.id, summary: "Keep new title" },
  };
  data.operations = [
    mixed,
    {
      opId: "comment",
      type: "comment",
      issueId: parent.id,
      text: "Unrelated queued comment",
      created: 1,
    },
  ];
  data.commentDrafts.keep = "Unrelated draft";
  data.cloud = {
    autoSync: false,
    accountId: "2-2",
    records: {
      archived: {
        status: "confirmed",
        message: "Prior preserved operation",
        archivedOperation: { ...structuredClone(mixed), opId: "archived" },
      },
    },
  };
  const scope = { userId: "2-2", projectId: "p" },
    preview = previewHierarchyRecovery(data, data.remote, scope);
  applyHierarchyRecovery(data, preview, ["mixed"], scope);
  assert.deepEqual(
    data.operations[0]?.type === "edit" && data.operations[0].patch,
    { summary: "Keep new title" },
  );
  assert.match(
    JSON.stringify(data.cloud.records.archived?.archivedOperation),
    /parentId.*PMON-2/,
  );
  const { port, remote } = navigationPort([item, parent]);
  port.accountId = "2-2";
  const updates: { id: string; patch: TaskPatch }[] = [];
  port.update = (id, patch) => {
    updates.push({ id, patch: structuredClone(patch) });
    const current = remote.get(id);
    assert.ok(current);
    Object.assign(current, patch);
    return Promise.resolve();
  };
  await deliverQueue(
    () => data,
    (change) => {
      change(data);
      return Promise.resolve();
    },
    port,
    undefined,
    () => updates.length === 0,
  );
  assert.deepEqual(updates, [
    { id: "PMON-1", patch: { summary: "Keep new title" } },
  ]);
  assert.equal(remote.get(item.id)?.parentId, null);
  assert.equal(data.operations.length, 1);
  assert.equal(data.operations[0]?.opId, "comment");
  assert.equal(data.commentDrafts.keep, "Unrelated draft");
  assert.match(JSON.stringify(data.hierarchyRecovery), /parentId.*PMON-2/);
});
