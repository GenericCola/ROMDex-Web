import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { scopedWorkspaceKey } from "../../src/storage/workspace-key";
import { labelledPersistence } from "../fixtures/memory-persistence";
import { deferred } from "../fixtures/values";
test("workspace scopes distinguish account and project without claiming legacy data", async () => {
  const origin = "https://tenant.youtrack.cloud";
  assert.equal(
    scopedWorkspaceKey(origin, "1-1", "0-1"),
    scopedWorkspaceKey(origin + "/", "1-1", "0-1"),
  );
  assert.notEqual(
    scopedWorkspaceKey(origin, "1-1", "0-1"),
    scopedWorkspaceKey(origin, "1-2", "0-1"),
  );
  assert.notEqual(
    scopedWorkspaceKey(origin, "1-1", "0-1"),
    scopedWorkspaceKey(origin, "1-1", "0-2"),
  );
  for (const bad of [
    "http://tenant.test",
    "https://u:p@tenant.test",
    "https://tenant.test/path",
    "https://tenant.test?secret=x",
  ])
    assert.throws(() => scopedWorkspaceKey(bad, "1-1", "0-1"));
  assert.throws(() => scopedWorkspaceKey(origin, "", "0-1"));
  const legacy = labelledPersistence("legacy", 1),
    a = labelledPersistence("A", 1),
    b = labelledPersistence("B", 1);
  const store = new WorkspaceStore(legacy);
  await store.start();
  await store.switchPersistence(a);
  assert.equal(store.getSnapshot().data.commentDrafts.label, "A");
  await store.change((data) => {
    data.commentDrafts.label = "saved A";
  });
  await store.switchPersistence(b);
  assert.equal(store.getSnapshot().data.commentDrafts.label, "B");
  await store.switchPersistence(a);
  assert.equal(store.getSnapshot().data.commentDrafts.label, "saved A");
  assert.equal((await legacy.load()).data.commentDrafts.label, "legacy");
});
test("scope switching hides prior data, rejects concurrent writes and ignores stale loads", async () => {
  const old = deferred<{ data: WorkspaceData; revision: number } | undefined>();
  const next = deferred<
    { data: WorkspaceData; revision: number } | undefined
  >();
  const store = new WorkspaceStore({
    load: () => old.promise,
    save: async () => 1,
  });
  const opening = store.start();
  const changing = store.switchPersistence({
    load: () => next.promise,
    save: async () => 1,
  });
  await Promise.resolve();
  assert.equal(store.getSnapshot().ready, false);
  assert.deepEqual(store.getSnapshot().data, emptyWorkspace());
  assert.throws(() => store.change(() => undefined), /switching/);
  await assert.rejects(
    store.switchPersistence(labelledPersistence("wrong", 1)),
    /switching workspaces/,
  );
  const obsolete = emptyWorkspace();
  obsolete.commentDrafts.secret = "old";
  old.resolve({ data: obsolete, revision: 99 });
  await opening;
  assert.equal(store.getSnapshot().data.commentDrafts.secret, undefined);
  next.resolve(undefined);
  await changing;
  assert.equal(store.getSnapshot().ready, true);
  assert.deepEqual(store.getSnapshot().data, emptyWorkspace());
});
test("failed old saves block switching and preserve unsaved recovery", async () => {
  let readNext = false;
  const store = new WorkspaceStore({
    load: async () => undefined,
    save: async () => {
      throw Error("Disk full");
    },
  });
  await store.start();
  void store.change((data) => {
    data.commentDrafts.recover = "keep";
  });
  await assert.rejects(
    store.switchPersistence({
      load: async () => {
        readNext = true;
        return undefined;
      },
      save: async () => 1,
    }),
    /Disk full/,
  );
  assert.equal(readNext, false);
  assert.equal(store.getSnapshot().data.commentDrafts.recover, "keep");
});

test("workspace switching waits for old saves and refuses delivery/update sessions", async () => {
  const saving = deferred<number>();
  const store = new WorkspaceStore({
    load: async () => undefined,
    save: () => saving.promise,
  });
  await store.start();
  void store.change((data) => {
    data.commentDrafts.keep = "old pending";
  });
  let nextLoaded = false;
  const switching = store.switchPersistence({
    load: async () => {
      nextLoaded = true;
      return undefined;
    },
    save: async () => 1,
  });
  await Promise.resolve();
  assert.equal(nextLoaded, false);
  saving.resolve(1);
  await switching;
  assert.equal(nextLoaded, true);
  const delivering = deferred<void>();
  const delivery = store.deliver(async () => {
    await delivering.promise;
  });
  await assert.rejects(
    store.switchPersistence(labelledPersistence("wrong", 1)),
    /Finish delivery/,
  );
  delivering.resolve();
  await delivery;
  const release = await store.prepareUpdate();
  await assert.rejects(
    store.switchPersistence(labelledPersistence("wrong", 1)),
    /Finish delivery/,
  );
  release();
});
