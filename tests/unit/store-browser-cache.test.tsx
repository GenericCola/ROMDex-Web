import assert from "node:assert/strict";
import { test } from "node:test";
import { StoreCache } from "../../src/store/browser/cache";
import { storeIndexedDb } from "../fixtures/store-idb";

const withCache = async (run: (cache: StoreCache) => Promise<void>) => {
  const old = globalThis.indexedDB;
  globalThis.indexedDB = storeIndexedDb();
  try {
    await run(new StoreCache());
  } finally {
    globalThis.indexedDB = old;
  }
};

test("state defaults empty and round trips per scope and store", () => {
  return withCache(async (cache) => {
    assert.deepEqual(await cache.getState("a", "npcdex"), {
      pending: false,
      refused: [],
      review: [],
    });
    const state = {
      articleId: "1-1",
      base: { revision: 3, writeId: "w", values: { "image/PMON-1": "x" } },
      pending: true,
      refused: [],
      review: [],
    };
    await cache.putState("a", "npcdex", state);
    assert.deepEqual(await cache.getState("a", "npcdex"), state);
    assert.equal((await cache.getState("b", "npcdex")).pending, false);
    assert.equal((await cache.getState("a", "romdex-metadata")).pending, false);
  });
});

test("blobs are stored by hash", () => {
  return withCache(async (cache) => {
    const blobs = cache.blobCache();
    assert.equal(await blobs.get("h"), undefined);
    await blobs.put("h", new Uint8Array([1, 2, 3]));
    assert.deepEqual(await blobs.get("h"), new Uint8Array([1, 2, 3]));
  });
});

test("recovery entries only append and are listed per scope", () => {
  return withCache(async (cache) => {
    const entry = (scope: string, key: string) => {
      return {
        at: "t",
        scope,
        store: "npcdex" as const,
        key,
        reason: "conflict" as const,
      };
    };
    await cache.addRecovery(entry("a", "one"));
    await cache.addRecovery(entry("a", "one"));
    await cache.addRecovery(entry("b", "two"));
    assert.equal((await cache.listRecovery("a")).length, 2);
    assert.equal((await cache.listRecovery("b")).length, 1);
    assert.equal((await cache.listRecovery("c")).length, 0);
  });
});
