import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentName,
  decodePart,
  emptyManifest,
  encodePart,
  encodeParts,
  fromBase64,
  gunzipBytes,
  gzipBytes,
  imageDataUrl,
  manifestContent,
  megabytes,
  parseImageDataUrl,
  PartTooLargeError,
  readManifest,
  samePartValue,
  sha256Hex,
  toBase64,
  tooLargeMessage,
  utf8,
  type ManifestFile,
  type StoreManifest,
} from "../../src/store/parts/index.ts";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
const SHA = "a".repeat(64);

const file = (over: Partial<ManifestFile> = {}): ManifestFile => ({
  name: "x.json.gz",
  sha256: SHA,
  size: 3,
  where: "youtrack",
  id: "1-1",
  codec: "gzip-json",
  ...over,
});

const manifest = (): StoreManifest => ({
  ...emptyManifest("npcdex", "2-1", "w1", "2026-11-07T10:00:00.000Z"),
  revision: 7,
  files: { root: file(), "image/x": file({ codec: "raw", type: "image/png" }) },
  source: { repo: "r", commit: "c", head: "h", sha256: SHA },
});

const block = (value: unknown): string =>
  "note\n\n```json\n" + JSON.stringify(value) + "\n```\n";

test("limits format sizes and the refusal message", () => {
  assert.equal(megabytes(5_200_000), "5.2 MB");
  assert.equal(megabytes(4_000_001), "4.0 MB");
  assert.equal(
    tooLargeMessage("a.png", 5_200_000),
    '"a.png" is 5.2 MB. ROMDex can store files up to 4 MB in YouTrack for now. Nothing was uploaded; your copy stays in this browser.',
  );
});

test("parts over 4,000,000 bytes are refused and others still encode", async () => {
  const big = {
    key: "image/big",
    codec: "raw",
    bytes: new Uint8Array(4_000_001),
    type: "image/png",
  } as const;
  const edge = {
    key: "image/edge",
    codec: "raw",
    bytes: new Uint8Array(4_000_000),
    type: "image/png",
  } as const;
  const small = { key: "orders", codec: "gzip-json", value: {} } as const;
  await assert.rejects(encodePart(big), PartTooLargeError);
  assert.equal((await encodePart(edge)).size, 4_000_000);
  const { encoded, refused } = await encodeParts([big, small, edge]);
  assert.deepEqual(
    encoded.map((p) => p.key),
    ["orders", "image/edge"],
  );
  assert.equal(refused.length, 1);
  assert.equal(refused[0]?.key, "image/big");
  assert.equal(refused[0]?.size, 4_000_001);
  assert.equal(
    refused[0]?.message,
    tooLargeMessage(refused[0]?.name ?? "", 4_000_001),
  );
  await assert.rejects(encodeParts([small, small]), /Duplicate/);
});

test("bytes: hash, gzip, limits and base64", async () => {
  assert.equal(
    await sha256Hex(utf8("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const text = utf8("hello ".repeat(1000));
  const zipped = await gzipBytes(text);
  assert.ok(zipped.length < text.length);
  assert.deepEqual(await gunzipBytes(zipped, 6000), text);
  await assert.rejects(gunzipBytes(zipped, 5999), /larger/);
  assert.equal(toBase64(PNG), "iVBORw0KGgoAAQI=");
  assert.deepEqual(fromBase64("iVBORw0KGgoAAQI="), PNG);
  for (const bad of [
    "iVBORw0KGgoAAQI",
    "iVBORw0KGgoAAQJ=",
    "iVB*",
    "iVBORw0KGgoAAQI===",
  ])
    assert.throws(() => fromBase64(bad), bad);
});

test("parseImageDataUrl is byte exact", () => {
  const url = imageDataUrl({ type: "image/png", bytes: PNG });
  assert.equal(url, "data:image/png;base64,iVBORw0KGgoAAQI=");
  assert.deepEqual(parseImageDataUrl(url), { type: "image/png", bytes: PNG });
  assert.equal(
    parseImageDataUrl("data:image/png;base64,iVBORw0KGgoAAQJ="),
    null,
  );
  assert.equal(
    parseImageDataUrl("data:image/png;base64,iVBORw0KGgoAAQI"),
    null,
  );
  assert.equal(
    parseImageDataUrl("data:text/plain;base64,iVBORw0KGgoAAQI="),
    null,
  );
  assert.equal(parseImageDataUrl("data:image/png;base64,"), null);
});

test("manifest round trip and rejections", () => {
  const m = manifest();
  const read = readManifest(manifestContent(m), "npcdex");
  assert.deepEqual(read, { kind: "ok", manifest: m });
  assert.deepEqual(readManifest("no block", "npcdex"), { kind: "missing" });
  assert.deepEqual(readManifest(null, "npcdex"), { kind: "missing" });
  assert.deepEqual(readManifest(manifestContent(m), "romdex-metadata"), {
    kind: "other-store",
    store: "npcdex",
  });
  assert.deepEqual(readManifest(block({ ...m, version: 2 }), "npcdex"), {
    kind: "newer",
    version: 2,
  });
  const bad = (value: unknown): string =>
    readManifest(block(value), "npcdex").kind;
  assert.equal(bad({ ...m, revision: -1 }), "invalid");
  assert.equal(bad({ ...m, extra: 1 }), "invalid");
  assert.equal(bad({ ...m, files: { a: file({ sha256: "ABC" }) } }), "invalid");
  assert.equal(
    bad({ ...m, files: { a: { ...file(), codec: "zip" } } }),
    "invalid",
  );
  assert.equal(bad({ ...m, files: { a: file({ size: 1.5 }) } }), "invalid");
  assert.equal(bad({ ...m, files: { a: { ...file(), more: 1 } } }), "invalid");
  assert.equal(bad({ ...m, source: { repo: "r" } }), "invalid");
  assert.equal(readManifest("```json\n{oops\n```", "npcdex").kind, "invalid");
});

test("attachment names", () => {
  const sha = "4be1" + "0".repeat(60);
  assert.equal(
    attachmentName("town/new-bark-town", sha, "gzip-json"),
    "town--new-bark-town--4be1000000000000.json.gz",
  );
  assert.equal(
    attachmentName("image/PMON-12", sha, "raw", "image/jpeg"),
    "image--PMON-12--4be1000000000000.jpg",
  );
  assert.equal(
    attachmentName("image/a", sha, "raw", "image/x"),
    "image--a--4be1000000000000.bin",
  );
  assert.equal(
    attachmentName("town/é ü?", sha, "gzip-json"),
    "town--____--4be1000000000000.json.gz",
  );
  const long = attachmentName("k".repeat(500), sha, "gzip-json");
  assert.equal(long, `${"k".repeat(120)}--4be1000000000000.json.gz`);
});

test("files: round trip, checks before unzip, comparison", async () => {
  const json = {
    key: "orders",
    codec: "gzip-json",
    value: { a: ["b"] },
  } as const;
  const raw = {
    key: "image/p",
    codec: "raw",
    bytes: PNG,
    type: "image/png",
  } as const;
  for (const part of [json, raw]) {
    const e = await encodePart(part);
    const entry = file({
      name: e.name,
      sha256: e.sha256,
      size: e.size,
      codec: e.codec,
      ...(e.type ? { type: e.type } : {}),
    });
    const back = await decodePart(part.key, entry, e.bytes);
    assert.ok(samePartValue(part, back));
  }
  const e = await encodePart(json);
  const entry = file({ sha256: e.sha256, size: e.size });
  await assert.rejects(
    decodePart("orders", { ...entry, size: e.size + 1 }, e.bytes),
    /orders.*size/,
  );
  await assert.rejects(
    decodePart("orders", { ...entry, sha256: SHA }, e.bytes),
    /orders.*SHA-256/,
  );
  // Not gzip at all: matching size and hash would only fail at gunzip.
  const junk = utf8("not gzip");
  const junkEntry = file({ sha256: await sha256Hex(junk), size: junk.length });
  await assert.rejects(decodePart("orders", junkEntry, junk));
  await assert.rejects(
    decodePart("orders", { ...junkEntry, sha256: SHA }, junk),
    /SHA-256/,
  );
  assert.ok(samePartValue(json, { ...json, value: { a: ["b"] } }));
  assert.ok(!samePartValue(json, { ...json, value: { a: ["c"] } }));
  assert.ok(!samePartValue(json, raw));
  assert.ok(!samePartValue(raw, { ...raw, type: "image/gif" }));
  assert.ok(samePartValue(raw, { ...raw, bytes: PNG.slice() }));
});
