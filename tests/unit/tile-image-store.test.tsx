import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
import { exportWorkspace } from "../../src/domain/workspace-recovery";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { prepareImages } from "../../src/storage/image-migration";
import {
  IMAGE_REF,
  imageMissing,
  imageUrl,
  putImage,
} from "../../src/storage/image-storage";
import { romdexBinding } from "../../src/store/browser/romdex-binding";
import { syncStore } from "../../src/store/browser/sync";
import { FakeYouTrackStore } from "../fixtures/fake-youtrack-store";
import { memoryPersistence } from "../fixtures/memory-persistence";
import { GIF, PNG } from "../fixtures/store-core-setup";
import { device, twoArticles, withIdb } from "../fixtures/store-sync-setup";

const legacy = () => {
  const data = emptyWorkspace();
  data.images = { "PMON-1": PNG, "local-a": GIF };
  return data;
};

void test("putImage is idempotent and returns a content ref", () => {
  return withIdb(async () => {
    const a = await putImage(PNG);
    assert.match(a, IMAGE_REF);
    assert.equal(await putImage(PNG), a);
    assert.notEqual(await putImage(GIF), a);
    assert.equal(imageUrl(a), PNG);
    assert.equal(imageUrl(PNG), PNG);
    await assert.rejects(putImage("data:text/plain;base64,AA=="), /Invalid/);
  });
});

void test("loading a legacy workspace moves every image into the store as a ref", () => {
  return withIdb(async () => {
    const persistence = memoryPersistence(legacy());
    const store = new WorkspaceStore(persistence);
    await store.start();
    await store.flush();
    const { images } = persistence.data;
    assert.match(images?.["PMON-1"] ?? "", IMAGE_REF);
    assert.equal(imageUrl(images?.["PMON-1"]), PNG);
    assert.equal(imageUrl(images?.["local-a"]), GIF);
    assert.ok(
      !JSON.stringify(persistence.data).includes("data:image"),
      "the workspace record holds no image bytes",
    );
    const exported = JSON.parse(exportWorkspace(store.getSnapshot().data));
    assert.deepEqual(exported.data.images, { "PMON-1": PNG, "local-a": GIF });
    validateWorkspace(exported.data);
  });
});

void test("a failed image save leaves the legacy record unchanged", async () => {
  const old = globalThis.indexedDB;
  globalThis.indexedDB = {
    open: () => {
      const request: { onerror?: () => void } = {};
      queueMicrotask(() => {
        return request.onerror?.();
      });
      return request;
    },
  } as unknown as IDBFactory;
  try {
    assert.deepEqual(await prepareImages(legacy()), {});
    const persistence = memoryPersistence(legacy());
    const store = new WorkspaceStore(persistence);
    await store.start();
    await store.flush();
    assert.deepEqual(persistence.data.images, {
      "PMON-1": PNG,
      "local-a": GIF,
    });
    assert.equal(store.getSnapshot().ready, true);
  } finally {
    globalThis.indexedDB = old;
  }
});

void test("a ref with no stored image fails softly: the workspace opens and recovery lists it", () => {
  return withIdb(async () => {
    const ref = `sha256-${"0".repeat(64)}`;
    const data = emptyWorkspace();
    data.images = { "PMON-1": ref };
    const store = new WorkspaceStore(memoryPersistence(data));
    await store.start();
    assert.equal(store.getSnapshot().error, "");
    assert.equal(store.getSnapshot().ready, true);
    assert.equal(imageMissing(ref), true);
    assert.equal(imageUrl(ref), null);
    const exported = JSON.parse(store.recover()) as {
      missingImages: string[];
      data: { images: Record<string, string> };
    };
    assert.deepEqual(exported.missingImages, [ref]);
    assert.equal(exported.data.images["PMON-1"], ref);
    // Sync carries the key from YouTrack's copy instead of removing it.
    const base = { "image/PMON-1": PNG };
    assert.deepEqual(
      romdexBinding.local(data, base, base)["image/PMON-1"],
      PNG,
    );
  });
});

const sync = async (d: ReturnType<typeof device>, fake: FakeYouTrackStore) => {
  const outcome = await syncStore(d.deps(fake), romdexBinding);
  return outcome.kind === "synced" ? outcome : assert.fail(outcome.kind);
};

void test("sync before and after the move to refs writes nothing", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.images = { "PMON-2": PNG };
    assert.equal((await sync(a, fake)).written, true);
    const calls = fake.calls.length;
    a.snapshot.data.images = { "PMON-2": await putImage(PNG) };
    const after = await sync(a, fake);
    assert.equal(after.written, false);
    assert.deepEqual(
      romdexBinding.local(a.snapshot.data, null, {})["image/PMON-2"],
      PNG,
    );
    // Another device receives the image as a ref whose bytes are already saved.
    const b = device("b");
    await sync(b, fake);
    const ref = b.snapshot.data.images?.["PMON-2"] ?? "";
    assert.match(ref, IMAGE_REF);
    assert.equal(imageUrl(ref), PNG);
    assert.ok(fake.calls.length > calls);
  });
});
