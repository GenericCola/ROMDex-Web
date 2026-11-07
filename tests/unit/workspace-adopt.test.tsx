import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";

/** One browser database shared by two windows, with the real revision check. */
const sharedStorage = () => {
  let record = { data: emptyWorkspace(), revision: 0 };
  return {
    load: () => {
      return Promise.resolve(structuredClone(record));
    },
    save: (data: WorkspaceData, expected: number) => {
      if (record.revision !== expected)
        return Promise.reject(Error("Another ROMDex window saved first."));
      record = { data: structuredClone(data), revision: expected + 1 };
      return Promise.resolve(record.revision);
    },
  };
};
const idle = () => {
  return true;
};

test("a window with nothing unsaved adopts another window's newer save and keeps editing", async () => {
  const storage = sharedStorage();
  const first = new WorkspaceStore(storage),
    second = new WorkspaceStore(storage);
  await first.start();
  await second.start();
  await second.change((data) => {
    data.commentDrafts.b = "second window";
  });
  assert.equal(await first.adoptNewer(idle), true);
  assert.equal(first.getSnapshot().data.commentDrafts.b, "second window");
  await first.change((data) => {
    data.commentDrafts.a = "first window";
  });
  assert.equal(first.getSnapshot().error, "");
  assert.equal((await storage.load()).data.commentDrafts.b, "second window");
  assert.equal(await first.adoptNewer(idle), false);
});

test("a window with unsaved edits does not adopt, and its save still refuses to overwrite", async () => {
  const storage = sharedStorage();
  const first = new WorkspaceStore(storage, 60_000),
    second = new WorkspaceStore(storage);
  await first.start();
  await second.start();
  const pending = first.change((data) => {
    data.commentDrafts.a = "unsaved";
  });
  await second.change((data) => {
    data.commentDrafts.b = "second window";
  });
  assert.equal(await first.adoptNewer(idle), false);
  assert.equal(
    await first.adoptNewer(() => {
      return false;
    }),
    false,
  );
  first.saveNow();
  await pending;
  assert.match(first.getSnapshot().error, /saved first/);
  assert.equal(first.getSnapshot().data.commentDrafts.a, "unsaved");
});
