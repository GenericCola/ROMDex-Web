// The adapter over src/store/parts: the migration must split, encode and
// rebuild exactly as the store does, and report oversized parts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  decodePart,
  encodeParts,
  joinMetadata,
  joinNpcdex,
  MAX_PART_BYTES,
  splitMetadata,
  splitNpcdex,
} from "./parts.mjs";

const PNG = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
const GIF = `data:image/gif;base64,${Buffer.from("gif-bytes").toString("base64")}`;
const SVG_INLINE = "data:image/svg+xml,<svg/>";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

const roundTrip = async (parts, join) => {
  const { encoded, refused } = await encodeParts(parts);
  assert.deepEqual(refused, []);
  return join(await Promise.all(encoded.map(decodePart)));
};

test("metadata parts round-trip through the store encoder", async () => {
  const doc = {
    version: 1,
    images: { "PMON-1": PNG },
    orders: { "PMON-2": ["PMON-3", "PMON-4"] },
    assigned: { "PMON-2": "In Development" },
  };
  const parts = splitMetadata(doc);
  assert.deepEqual(
    parts.map((part) => part.key),
    ["orders", "assigned", "image/PMON-1"],
  );
  assert.deepEqual(await roundTrip(parts, joinMetadata), doc);
});

test("NPCDex parts rebuild the exact bytes and count images", async () => {
  const doc = {
    version: 2,
    app: "NPCDex",
    towns: [
      { id: "new-bark-town", image: { src: PNG }, areas: [] },
      { id: "route-29", image: { src: PNG }, icon: SVG_INLINE },
    ],
    annotations: { "a-1": { note: "x", icon: GIF } },
    characterImages: { rival: PNG },
    changePlans: { "p-1": { title: "plan" } },
    history: [{ id: "h-1", timestamp: "2026-10-01T00:00:00Z" }],
    revision: 3,
  };
  const split = await splitNpcdex(doc);
  assert.equal(split.images, 2);
  assert.equal(split.imageRefs, 4);
  assert.equal(split.inlineImages, 1);
  const keys = split.parts.map((part) => part.key);
  for (const key of ["root", "town/new-bark-town", "town/route-29"])
    assert.ok(keys.includes(key), key);
  for (const key of ["annotations", "plans", "history"])
    assert.ok(keys.includes(key), key);
  const rebuilt = await roundTrip(split.parts, joinNpcdex);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(doc));
});

test("encodeParts adds raw sizes and names stored bytes by hash", async () => {
  const { encoded } = await encodeParts([
    { key: "orders", codec: "gzip-json", value: { a: ["b"] } },
  ]);
  const [part] = encoded;
  assert.equal(part.rawSize, Buffer.byteLength('{"a":["b"]}'));
  assert.equal(part.sha256, sha(part.bytes));
  assert.equal(part.size, part.bytes.length);
  assert.equal(part.name, `orders--${part.sha256.slice(0, 16)}.json.gz`);
});

test("a part over the limit is refused, not thrown", async () => {
  const big = {
    key: "image/big",
    codec: "raw",
    type: "image/png",
    bytes: new Uint8Array(MAX_PART_BYTES + 1),
  };
  const edge = {
    ...big,
    key: "image/edge",
    bytes: new Uint8Array(MAX_PART_BYTES),
  };
  const { encoded, refused } = await encodeParts([big, edge]);
  assert.deepEqual(
    encoded.map((part) => part.key),
    ["image/edge"],
  );
  assert.equal(refused.length, 1);
  assert.equal(refused[0].key, "image/big");
  assert.equal(refused[0].size, MAX_PART_BYTES + 1);
  assert.equal(refused[0].rawSize, MAX_PART_BYTES + 1);
  assert.match(refused[0].message, /up to 4 MB/);
});

test("decodePart refuses tampered bytes", async () => {
  const { encoded } = await encodeParts([
    { key: "assigned", codec: "gzip-json", value: { x: "y" } },
  ]);
  const tampered = { ...encoded[0], bytes: encoded[0].bytes.slice() };
  tampered.bytes[tampered.bytes.length - 1] ^= 1;
  await assert.rejects(decodePart(tampered), /SHA-256/);
});
