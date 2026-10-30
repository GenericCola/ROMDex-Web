import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  applyOrderRecovery,
  orderBackup,
  previewOrderRecovery,
} from "../../src/domain/order-recovery";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { exportWorkspace } from "../../src/domain/workspace-recovery";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const scope = { userId: "synthetic-user", projectId: "synthetic-PMON" };
const fixture = () => {
  const data = emptyWorkspace();
  createTask(data, null, "Alpha");
  createTask(data, null, "Beta");
  data.commentDrafts.keep = "Keep draft";
  data.cloud = { autoSync: true, accountId: scope.userId, records: {} };
  return data;
};
const recovery = (data: ReturnType<typeof fixture>) =>
  JSON.stringify({
    ...JSON.parse(exportWorkspace(data)),
    recoveryScope: scope,
  });
test("order restore changes only order, preserving hierarchy queue drafts and all other fields", async () => {
  const current = fixture(),
    correct = structuredClone(current);
  const ids = current.operations.map((op) => op.issueId);
  correct.order = Object.fromEntries(
    ids.map((id, i) => [id, ids.length - i - 1]),
  );
  const before = structuredClone(current),
    preview = previewOrderRecovery(recovery(correct), current, scope);
  let saves = 0;
  const store = new WorkspaceStore({
    load: async () => ({ revision: 0, data: current }),
    save: async (_data, revision) => {
      saves++;
      return revision + 1;
    },
  });
  await store.start();
  await store.change((data) => applyOrderRecovery(data, preview, scope));
  await store.flush();
  assert.equal(saves, 1);
  assert.deepEqual(
    { ...store.getSnapshot().data, order: null },
    { ...before, order: null },
  );
  assert.deepEqual(store.getSnapshot().data.order, correct.order);
  const backup = orderBackup(before, scope);
  const reverse = previewOrderRecovery(backup, store.getSnapshot().data, scope);
  applyOrderRecovery(store.getSnapshot().data, reverse, scope);
  assert.deepEqual(
    { ...store.getSnapshot().data, order: null },
    { ...before, order: null },
  );
});
test("scope, IDs, hierarchy, invalid ranks, stale preview and changed identity reject safely", () => {
  const data = fixture(),
    before = structuredClone(data),
    text = recovery(data);
  assert.throws(
    () => previewOrderRecovery(exportWorkspace(data), data, scope),
    /fresh recovery/,
  );
  assert.throws(
    () => previewOrderRecovery(text, data, { ...scope, userId: "another" }),
    /Account or project/,
  );
  assert.throws(
    () => previewOrderRecovery(text, data, { ...scope, projectId: "another" }),
    /Account or project/,
  );
  const missing = fixture();
  assert.throws(
    () => previewOrderRecovery(recovery(missing), data, scope),
    /Task IDs differ/,
  );
  const hierarchy = structuredClone(data);
  const first = hierarchy.operations[0],
    second = hierarchy.operations[1];
  if (first?.type !== "create" || second?.type !== "create")
    throw Error("fixture");
  second.item.parentId = first.issueId;
  assert.throws(
    () => previewOrderRecovery(recovery(hierarchy), data, scope),
    /hierarchy differs/,
  );
  const bad = JSON.parse(orderBackup(data, scope));
  bad.order.unknown = 0;
  assert.throws(
    () => previewOrderRecovery(JSON.stringify(bad), data, scope),
    /unknown IDs/,
  );
  bad.order = { [first.issueId]: -1 };
  assert.throws(
    () => previewOrderRecovery(JSON.stringify(bad), data, scope),
    /invalid ranks/,
  );
  const preview = previewOrderRecovery(text, data, scope);
  data.commentDrafts.extra = "new";
  assert.throws(
    () => applyOrderRecovery(data, preview, scope),
    /changed since preview/,
  );
  assert.throws(
    () => applyOrderRecovery(before, preview, { ...scope, userId: "another" }),
    /Account or project/,
  );
});
test("recovery export never flushes or saves; order UI disconnects before mutation and has explicit backup confirmation", async () => {
  const source = await readFile(
    new URL("../../src/components/romdex/recovery-export.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /flushDraftEditors|workspaceStore\.(?:flush|change|setConnection)\(/,
  );
  assert.match(source, /workspaceStore\.recover\(\)/);
  assert.match(source, /recoveryWithUploads/);
  const ui =
    (await readFile(
      new URL(
        "../../src/components/romdex/order-recovery.tsx",
        import.meta.url,
      ),
      "utf8",
    )) +
    (await readFile(
      new URL(
        "../../src/components/romdex/use-order-recovery.ts",
        import.meta.url,
      ),
      "utf8",
    ));
  assert.match(ui, /disconnectDelivery\(\)/);
  assert.match(ui, /!backedUp \|\| !confirmed \|\| busy/);
  assert.doesNotMatch(ui, /saveDelivery|automaticDelivery|flushDraftEditors/);
});

test("memory export captures dirty buffers without flush; disconnected order save cannot leak its existing queue", async () => {
  const { workspaceStore } = await import("../../src/domain/workspace-store");
  const { registerDraftEditor } =
    await import("../../src/domain/editor-drafts");
  const { setAuthSession } = await import("../../src/auth/session");
  const { captureRecovery } =
    await import("../../src/components/romdex/recovery-export");
  const { disconnectDelivery } = await import("../../src/cloud/session");
  const { watchOutgoing } = await import("../../src/cloud/watch-outgoing");
  const data = fixture();
  let saves = 0,
    flushes = 0,
    requests = 0,
    published = 0;
  await workspaceStore.switchPersistence({
    load: async () => ({ revision: 0, data }),
    save: async (_next, revision) => {
      saves++;
      return revision + 1;
    },
  });
  setAuthSession({
    token: "synthetic",
    expiresAt: Date.now() + 10000,
    ...scope,
  });
  const unregister = registerDraftEditor({
    dirty: () => true,
    capture: () => ({ text: "dirty uncommitted editor" }),
    flush: async () => {
      flushes++;
      throw Error("Do not flush");
    },
  });
  const stopSubscription = workspaceStore.subscribe(() => {
    published++;
  });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests++;
    throw Error("No network allowed");
  };
  let stopOutgoing = () => {};
  try {
    const before = JSON.stringify(workspaceStore.getSnapshot());
    const exported = JSON.parse(await captureRecovery());
    assert.equal(flushes, 0);
    assert.equal(saves, 0);
    assert.equal(published, 0);
    assert.equal(JSON.stringify(workspaceStore.getSnapshot()), before);
    assert.match(
      JSON.stringify(exported.data.editorRecovery),
      /dirty uncommitted editor/,
    );
    assert.deepEqual(exported.recoveryScope, scope);
    assert.ok(Array.isArray(exported.uploads));
    unregister();
    disconnectDelivery();
    stopOutgoing = watchOutgoing();
    const correct = structuredClone(data);
    const ids = correct.operations.map((op) => op.issueId);
    correct.order = Object.fromEntries(
      ids.map((id, i) => [id, ids.length - i - 1]),
    );
    const preview = previewOrderRecovery(
      recovery(correct),
      workspaceStore.getSnapshot().data,
      scope,
    );
    await workspaceStore.change((next) =>
      applyOrderRecovery(next, preview, scope),
    );
    await workspaceStore.flush();
    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.equal(requests, 0);
    assert.deepEqual(
      workspaceStore.getSnapshot().data.operations,
      data.operations,
    );
    assert.equal(saves, 1);
    assert.equal(flushes, 0);
  } finally {
    stopSubscription();
    unregister();
    stopOutgoing();
    setAuthSession(null);
    globalThis.fetch = oldFetch;
  }
});
