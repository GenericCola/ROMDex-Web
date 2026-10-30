import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";

test("local save failure allows only transient view navigation and retains recovery", async () => {
  let saves = 0;
  const store = new WorkspaceStore({
    load: async () => undefined,
    save: async () => {
      saves++;
      throw Error("Synthetic quota failure");
    },
  });
  await store.start();
  await store.change((data) => {
    data.commentDrafts.keep = "unsaved text";
  });
  const before = store.getSnapshot().data;
  await store.change((data) => {
    data.view.workspace = "npcdex";
  });
  assert.equal(store.getSnapshot().data.view.workspace, "npcdex");
  assert.deepEqual(
    { ...store.getSnapshot().data, view: null },
    { ...before, view: null },
  );
  assert.equal(saves, 1);
  assert.match(store.recover(), /unsaved text/);
  assert.throws(
    () =>
      store.change((data) => {
        data.commentDrafts.keep = "overwrite";
      }),
    /quota/,
  );
  await assert.rejects(
    store.deliver(async () => {}),
    /not ready/,
  );
  await assert.rejects(store.prepareUpdate(), /quota/);
  assert.equal(store.getSnapshot().updating, false);
});

test("retry preserves queued data and original CAS revision, then permits editing", async () => {
  let failing = true;
  const revisions: number[] = [];
  let saved: WorkspaceData | undefined;
  const store = new WorkspaceStore({
    load: async () => undefined,
    save: async (data, revision) => {
      revisions.push(revision);
      if (failing) throw Error("Synthetic quota");
      saved = structuredClone(data);
      return revision + 1;
    },
  });
  await store.start();
  await store.change((data) => {
    data.commentDrafts.keep = "recovery";
  });
  await assert.rejects(store.retryLocalSave(), /quota/);
  assert.equal(store.getSnapshot().pendingWrites, 0);
  failing = false;
  await store.change((data) => {
    data.view.workspace = "npcdex";
  });
  await store.retryLocalSave();
  assert.deepEqual(revisions, [0, 0, 0]);
  assert.equal(saved?.commentDrafts.keep, "recovery");
  assert.equal(saved?.view.workspace, "npcdex");
  assert.equal(store.getSnapshot().error, "");
  await store.change((data) => {
    data.commentDrafts.keep = "editable again";
  });
  await store.flush();
  assert.equal(saved?.commentDrafts.keep, "editable again");
});

test("retry never reloads a newer revision or overwrites a conflicting window", async () => {
  let loads = 0;
  const revisions: number[] = [];
  const store = new WorkspaceStore({
    load: async () => {
      loads++;
      return undefined;
    },
    save: async (_data, revision) => {
      revisions.push(revision);
      throw Error("Another ROMDex window saved first.");
    },
  });
  await store.start();
  await store.change((data) => {
    data.commentDrafts.keep = "retain conflict";
  });
  await assert.rejects(store.retryLocalSave(), /window saved first/);
  assert.deepEqual(revisions, [0, 0]);
  assert.equal(loads, 1);
  assert.match(store.recover(), /retain conflict/);
  assert.equal(store.getSnapshot().pendingWrites, 0);
  await store.change((data) => {
    data.view.workspace = "npcdex";
  });
  assert.equal(store.getSnapshot().data.view.workspace, "npcdex");
});

test("local failure recovery preserves an uncertain delivery journal and queue", async () => {
  const data = emptyWorkspace();
  data.operations.push({
    type: "comment",
    opId: "held",
    issueId: "PMON-499",
    text: "queued fixture",
    created: 1,
  });
  data.cloud = {
    autoSync: false,
    accountId: "fixture-account",
    records: {
      held: { status: "uncertain", message: "Keep delivery evidence" },
    },
  };
  let failing = true;
  let saved: WorkspaceData | undefined;
  const store = new WorkspaceStore({
    load: async () => ({ revision: 7, data }),
    save: async (next, revision) => {
      assert.equal(revision, 7);
      if (failing) throw Error("Synthetic quota");
      saved = structuredClone(next);
      return 8;
    },
  });
  await store.start();
  await store.change((next) => {
    next.view.scope = "PMON-499";
  });
  await store.change((next) => {
    next.view.workspace = "npcdex";
  });
  assert.deepEqual(store.getSnapshot().data.operations, data.operations);
  assert.deepEqual(store.getSnapshot().data.cloud, data.cloud);
  assert.match(store.recover(), /Keep delivery evidence/);
  failing = false;
  await store.retryLocalSave();
  assert.deepEqual(saved?.operations, data.operations);
  assert.deepEqual(saved?.cloud, data.cloud);
});
