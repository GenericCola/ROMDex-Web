import assert from "node:assert/strict";
import { test } from "node:test";
import { stagedFile } from "../../src/attachments/validate";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { UploadStorage } from "../../src/storage/upload-storage";
import { WorkspaceStorage } from "../../src/storage/workspace-storage";
import { memoryIndexedDb } from "../fixtures/memory-indexed-db";

test("scoped workspace records preserve current and enforce independent revisions", async () => {
  const old = globalThis.indexedDB;
  globalThis.indexedDB = memoryIndexedDb();
  try {
    const legacy = new WorkspaceStorage(),
      a = new WorkspaceStorage("A"),
      b = new WorkspaceStorage("B");
    const data = emptyWorkspace();
    data.commentDrafts.secret = "legacy";
    await legacy.save(data, 0);
    assert.equal(await a.load(), undefined);
    data.commentDrafts.secret = "A";
    await a.save(data, 0);
    assert.equal(await b.load(), undefined);
    assert.equal((await legacy.load())?.data.commentDrafts.secret, "legacy");
    assert.equal((await a.load())?.data.commentDrafts.secret, "A");
    await assert.rejects(a.save(data, 0), /saved first/);
  } finally {
    globalThis.indexedDB = old;
  }
});
test("upload scopes isolate identical IDs and capture writes before async hashing", async () => {
  const old = globalThis.indexedDB;
  globalThis.indexedDB = memoryIndexedDb();
  try {
    const storage = new UploadStorage();
    const legacy = await stagedFile(
      "same-id",
      new File(["legacy"], "legacy.txt"),
    );
    await storage.put(legacy);
    storage.setScope("A");
    assert.equal(await storage.get("same-id"), undefined);
    const a = await stagedFile("same-id", new File(["A"], "a.txt"));
    const writing = storage.put(a);
    storage.setScope("B");
    await writing;
    assert.equal(await storage.get("same-id"), undefined);
    await storage.put(await stagedFile("same-id", new File(["B"], "b.txt")));
    await storage.remove("same-id");
    storage.setScope("A");
    assert.equal(await (await storage.get("same-id"))?.blob.text(), "A");
    storage.setScope();
    assert.equal(await (await storage.get("same-id"))?.blob.text(), "legacy");
  } finally {
    globalThis.indexedDB = old;
  }
});
