import assert from "node:assert/strict";
import { test } from "node:test";
import { readArticle } from "../../src/store/core/article.ts";
import type { BlobCache } from "../../src/store/core/read.ts";
import { readStore } from "../../src/store/core/read.ts";
import { commitStore } from "../../src/store/core/write.ts";
import { sha256Hex } from "../../src/store/parts/bytes.ts";
import type { StoreManifest } from "../../src/store/parts/manifest.ts";
import { manifestContent } from "../../src/store/parts/manifest.ts";
import {
  baseOf,
  freshStore,
  json,
  otherDevice,
  randomBytes,
} from "../fixtures/store-core-setup.tsx";

const written = async () => {
  const setup = await freshStore();
  const parts = [
    json("orders", { ROOT: ["PMON-1"] }),
    json("assigned", { a: 1 }),
  ];
  const result = await commitStore(setup.fake, {
    base: setup.base,
    parts,
    writtenBy: "2-1",
  });
  assert.ok(result.kind === "written");
  const article = await readArticle(setup.fake, setup.article.id);
  assert.ok(article);
  return { ...setup, parts, article, manifest: result.manifest };
};

test("a part over 4 MB is refused, the others are written, its old version stays", async () => {
  const { fake, article, base } = await freshStore();
  const small = {
    key: "image/PMON-9",
    codec: "raw" as const,
    type: "image/png",
  };
  await commitStore(fake, {
    base,
    parts: [{ ...small, bytes: randomBytes(10) }],
    writtenBy: "2-1",
  });
  const first = baseOf((await readArticle(fake, article.id)) ?? article);
  const before = (await readStore(fake, first.article, "romdex-metadata"))
    .manifest.files["image/PMON-9"];
  const big = { ...small, bytes: randomBytes(4_000_001) };
  const snapshot = await readStore(fake, first.article, "romdex-metadata");
  const result = await commitStore(fake, {
    base: snapshot,
    parts: [big, json("orders", { ROOT: [] })],
    writtenBy: "2-1",
  });
  assert.ok(result.kind === "written");
  const [refused] = result.refused;
  assert.match(
    refused?.message ?? "",
    /^"image--PMON-9--[0-9a-f]{16}\.png" is 4\.0 MB\. ROMDex can store files up to 4 MB in YouTrack for now\. Nothing was uploaded; your copy stays in this browser\.$/,
  );
  assert.deepEqual(result.uploaded, ["orders"]);
  assert.deepEqual(result.manifest.files["image/PMON-9"], before);
});

test("a manifest written after we read it gives moved, with no content write", async () => {
  const { fake, parts, article, manifest } = await written();
  const base = baseOf(article);
  fake.setContent(article.id, otherDevice(manifest));
  fake.calls.length = 0;
  const result = await commitStore(fake, {
    base,
    parts: [...parts, json("testing", { x: 1 })],
    writtenBy: "2-1",
  });
  assert.deepEqual(result, { kind: "moved" });
  assert.equal(fake.count("POST", new RegExp(`^articles/${article.id}$`)), 0);
});

test("a manifest replaced right after our write gives lost", async () => {
  const { fake, parts, article, manifest } = await written();
  const snapshot = await readStore(fake, article, "romdex-metadata");
  fake.onAfterContentWrite = () => {
    fake.setContent(article.id, otherDevice(manifest));
  };
  const result = await commitStore(fake, {
    base: snapshot,
    parts: parts.slice(0, 1),
    writtenBy: "2-1",
  });
  assert.deepEqual(result, { kind: "lost" });
});

test("readStore rejects bytes with a wrong SHA-256", async () => {
  const { fake, article, parts } = await written();
  const stored = fake.articles.get(article.id)?.attachments[0];
  assert.ok(stored && parts.length);
  fake.corrupt(article.id, stored.id);
  await assert.rejects(readStore(fake, article, "romdex-metadata"), /SHA-256/);
});

test("readStore rejects an attachment whose name or size changed", async () => {
  const { fake, article } = await written();
  const stored = fake.articles.get(article.id)?.attachments[0];
  assert.ok(stored);
  const name = stored.name;
  stored.name = "renamed.json.gz";
  await assert.rejects(
    readStore(fake, article, "romdex-metadata"),
    /missing or changed/,
  );
  stored.name = name;
  stored.bytes = new Uint8Array([...stored.bytes, 0]);
  await assert.rejects(
    readStore(fake, article, "romdex-metadata"),
    /missing or changed/,
  );
});

test("readStore refuses a newer manifest and says to update", async () => {
  const { fake, article, manifest } = await written();
  const newer = { ...manifest, version: 2 } as unknown as StoreManifest;
  fake.setContent(article.id, manifestContent(newer));
  const changed = await readArticle(fake, article.id);
  assert.ok(changed);
  await assert.rejects(
    readStore(fake, changed, "romdex-metadata"),
    /Update ROMDex/,
  );
});

test("parts kept elsewhere are listed and block the write", async () => {
  const { fake, article, manifest, parts } = await written();
  const [kept] = Object.entries(manifest.files);
  assert.ok(kept);
  const files = { ...manifest.files, [kept[0]]: { ...kept[1], where: "s3" } };
  fake.setContent(article.id, manifestContent({ ...manifest, files }));
  const changed = await readArticle(fake, article.id);
  assert.ok(changed);
  const snapshot = await readStore(fake, changed, "romdex-metadata");
  assert.deepEqual(snapshot.unavailable, [kept[0]]);
  fake.calls.length = 0;
  await assert.rejects(
    commitStore(fake, { base: snapshot, parts, writtenBy: "2-1" }),
    /Nothing was written/,
  );
  assert.equal(fake.calls.length, 0);
});

test("a blob cache saves the second download", async () => {
  const { fake, article } = await written();
  const store = new Map<string, Uint8Array>();
  const cache: BlobCache = {
    get: (sha) => Promise.resolve(store.get(sha)),
    put: (sha, bytes) => {
      store.set(sha, bytes);
      return Promise.resolve();
    },
  };
  await readStore(fake, article, "romdex-metadata", cache);
  assert.equal(fake.downloads.length, 2);
  const second = await readStore(fake, article, "romdex-metadata", cache);
  assert.equal(fake.downloads.length, 2);
  assert.equal(second.parts.length, 2);
  assert.ok(await sha256Hex(new Uint8Array(1)));
});
