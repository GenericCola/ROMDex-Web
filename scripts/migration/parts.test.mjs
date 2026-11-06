import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodePart,
  encodePart,
  imageDataUrl,
  joinMetadata,
  joinNpcdex,
  oversized,
  parseImageDataUrl,
  splitMetadata,
  splitNpcdex,
} from "./parts.mjs";

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PNG = `data:image/png;base64,${PNG_B64}`;
const GIF = imageDataUrl("image/gif", Buffer.from("GIF89a-test"));
const SVG_INLINE = "data:image/svg+xml,<svg/>";

test("parseImageDataUrl accepts a real PNG and rebuilds it", () => {
  const parsed = parseImageDataUrl(PNG);
  assert.equal(parsed.type, "image/png");
  assert.equal(parsed.bytes.subarray(1, 4).toString(), "PNG");
  assert.equal(imageDataUrl(parsed.type, parsed.bytes), PNG);
});

test("parseImageDataUrl rejects what it cannot rebuild", () => {
  assert.equal(parseImageDataUrl(SVG_INLINE), null);
  assert.equal(parseImageDataUrl("data:image/png;base64,AB=="), null); // non-canonical
  assert.equal(parseImageDataUrl("data:image/png;base64,QUJD="), null); // bad padding
  assert.equal(parseImageDataUrl("data:text/plain;base64,QUJD"), null);
  assert.equal(parseImageDataUrl(42), null);
});

function metaDoc(extra = {}) {
  return {
    version: 1,
    images: { "PMON-2": GIF, "PMON-1": PNG },
    orders: { a: 1 },
    assigned: { b: 2 },
    ...extra,
  };
}

test("splitMetadata parts and order", () => {
  const parts = splitMetadata(
    metaDoc({ reviews: { r: 1 }, testing: {}, acceptances: {} }),
  );
  assert.deepEqual(
    parts.map((p) => p.key),
    ["orders", "assigned", "reviews", "image/PMON-1", "image/PMON-2"],
  );
  assert.equal(parts[3].type, "image/png");
  assert.deepEqual(parts[2].value, { r: 1 });
});

test("splitMetadata always emits orders and assigned", () => {
  const parts = splitMetadata({ version: 1, images: {} });
  assert.deepEqual(
    parts.map((p) => p.key),
    ["orders", "assigned"],
  );
  assert.deepEqual(parts[0].value, {});
});

test("splitMetadata rejects unknown fields and bad images", () => {
  assert.throws(() => splitMetadata(metaDoc({ extra: 1 })), /extra/);
  assert.throws(
    () => splitMetadata(metaDoc({ images: { "PMON-9": SVG_INLINE } })),
    /PMON-9/,
  );
});

test("joinMetadata round-trips v1 and v4 documents", () => {
  const v1 = {
    version: 1,
    images: { "PMON-1": PNG, "PMON-2": GIF },
    orders: { a: 1 },
    assigned: { b: 2 },
  };
  assert.deepEqual(joinMetadata(splitMetadata(v1)), v1);
  const v4 = {
    version: 4,
    images: { "PMON-1": PNG },
    orders: { a: 1 },
    assigned: {},
    authorizations: {},
    acceptances: { x: 1 },
    reviews: { y: 2 },
  };
  const back = joinMetadata(splitMetadata(v4));
  assert.deepEqual(back, v4);
  assert.deepEqual(Object.keys(back), Object.keys(v4));
});

function npcDoc() {
  return {
    format: "npcdex",
    characterImages: { hero: PNG },
    towns: [
      { id: "new-bark-town", name: "New Bark", pics: [PNG, PNG, { a: GIF }] },
      { id: "cherrygrove", name: "Cherrygrove", note: SVG_INLINE },
    ],
    annotations: { n1: { text: "hi" } },
    changePlans: { p1: [1, 2] },
    history: [{ id: "h1" }, { id: "h2" }],
    version: 2,
  };
}

test("splitNpcdex parts, counts and exact round trip", () => {
  const doc = npcDoc();
  const res = splitNpcdex(doc);
  const keys = res.parts.map((p) => p.key);
  assert.equal(keys[0], "root");
  assert.deepEqual(keys.slice(1, 6), [
    "town/new-bark-town",
    "town/cherrygrove",
    "annotations",
    "plans",
    "history",
  ]);
  assert.equal(keys.length, 8);
  assert.ok(keys.slice(6).every((k) => k.startsWith("image/")));
  assert.equal(res.images, 2);
  assert.equal(res.imageRefs, 4);
  assert.equal(res.inlineImages, 1);
  const root = res.parts[0].value;
  assert.deepEqual(Object.keys(root), Object.keys(doc));
  assert.deepEqual(root.towns, {
    $part: "town",
    ids: ["new-bark-town", "cherrygrove"],
  });
  assert.deepEqual(root.history, { $part: "history" });
  assert.equal(JSON.stringify(joinNpcdex(res.parts)), JSON.stringify(doc));
});

test("splitNpcdex handles a missing history", () => {
  const doc = npcDoc();
  delete doc.history;
  const res = splitNpcdex(doc);
  assert.ok(!res.parts.some((p) => p.key === "history"));
  assert.equal(JSON.stringify(joinNpcdex(res.parts)), JSON.stringify(doc));
});

test("splitNpcdex survives encode/decode of every part", () => {
  const doc = npcDoc();
  const parts = splitNpcdex(doc).parts.map((p) => decodePart(encodePart(p)));
  assert.equal(JSON.stringify(joinNpcdex(parts)), JSON.stringify(doc));
});

test("joinNpcdex throws on a missing part", () => {
  const parts = splitNpcdex(npcDoc()).parts.filter((p) => p.key !== "plans");
  assert.throws(() => joinNpcdex(parts), /plans/);
});

test("splitNpcdex rejects reserved keys, duplicate and bad town ids", () => {
  const withKey = npcDoc();
  withKey.towns[0].extra = { $image: "x" };
  assert.throws(() => splitNpcdex(withKey), /\$image/);
  const withPart = npcDoc();
  withPart.annotations = [{ $part: "x" }];
  assert.throws(() => splitNpcdex(withPart), /\$part/);
  const dup = npcDoc();
  dup.towns[1].id = "new-bark-town";
  assert.throws(() => splitNpcdex(dup), /Duplicate/);
  const bad = npcDoc();
  bad.towns[1].id = "has space";
  assert.throws(() => splitNpcdex(bad), /Bad town id/);
});

test("encodePart names, hashes and decodePart round trip", async () => {
  const { createHash } = await import("node:crypto");
  const town = encodePart({
    key: "town/new-bark-town",
    codec: "gzip-json",
    value: { id: "new-bark-town" },
  });
  assert.match(town.name, /^town--new-bark-town--[0-9a-f]{16}\.json\.gz$/);
  assert.equal(
    town.sha256,
    createHash("sha256").update(town.bytes).digest("hex"),
  );
  assert.equal(town.size, town.bytes.length);
  assert.equal(town.rawSize, JSON.stringify({ id: "new-bark-town" }).length);
  assert.deepEqual(decodePart(town).value, { id: "new-bark-town" });

  const bytes = Buffer.from("png-bytes");
  const img = encodePart({
    key: "image/abc",
    codec: "raw",
    type: "image/png",
    bytes,
  });
  assert.match(img.name, /^image--abc--[0-9a-f]{16}\.png$/);
  assert.equal(img.rawSize, bytes.length);
  assert.deepEqual(decodePart(img), {
    key: "image/abc",
    codec: "raw",
    type: "image/png",
    bytes,
  });
  const odd = encodePart({
    key: "image/z",
    codec: "raw",
    type: "image/bmp",
    bytes,
  });
  assert.ok(odd.name.endsWith(".bin"));
  const jpg = encodePart({
    key: "image/z",
    codec: "raw",
    type: "image/jpeg",
    bytes,
  });
  assert.ok(jpg.name.endsWith(".jpg"));
});

test("decodePart throws on tampered bytes and encodePart on bad keys", () => {
  const enc = encodePart({
    key: "orders",
    codec: "gzip-json",
    value: { a: 1 },
  });
  const bad = { ...enc, bytes: Buffer.from(enc.bytes) };
  bad.bytes[bad.bytes.length - 1] ^= 1;
  assert.throws(() => decodePart(bad), /sha256/);
  assert.throws(
    () => encodePart({ key: "bad key", codec: "gzip-json", value: 1 }),
    /Bad part key/,
  );
});

test("oversized flags parts above 4,000,000 bytes", () => {
  const big = encodePart({
    key: "image/big",
    codec: "raw",
    type: "image/png",
    bytes: Buffer.alloc(4_000_001),
  });
  const ok = encodePart({
    key: "image/ok",
    codec: "raw",
    type: "image/png",
    bytes: Buffer.alloc(4_000_000),
  });
  assert.deepEqual(oversized([big, ok]), [big]);
});
