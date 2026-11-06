import assert from "node:assert/strict";
import { test } from "node:test";
import {
  metadataHash,
  metadataToParts,
  partsToMetadata,
  sha256Hex,
  utf8,
  type RomdexMetadata,
} from "../../src/store/parts/index.ts";

const PNG = "data:image/png;base64,iVBORw0KGgoAAQI=";
const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const doc = (): RomdexMetadata => ({
  version: 1,
  images: { "PMON-2": GIF, "PMON-1": PNG },
  orders: { ROOT: ["PMON-2", "PMON-1"], "PMON-9": [] },
  assigned: { "PMON-3": "In Development" },
});

test("metadata round trip with images and no extras", () => {
  const parts = metadataToParts(doc());
  assert.deepEqual(
    parts.map((p) => p.key),
    ["orders", "assigned", "image/PMON-2", "image/PMON-1"],
  );
  const back = partsToMetadata(parts);
  assert.deepEqual(back, {
    version: 1,
    images: { "PMON-1": PNG, "PMON-2": GIF },
    orders: { "PMON-9": [], ROOT: ["PMON-2", "PMON-1"] },
    assigned: { "PMON-3": "In Development" },
  });
});

test("extras are written when filled and set the version", () => {
  const full = {
    ...doc(),
    authorizations: {},
    testing: { "PMON-1": { ok: true } },
  };
  const parts = metadataToParts(full);
  assert.ok(parts.some((p) => p.key === "testing"));
  assert.ok(!parts.some((p) => p.key === "authorizations"));
  const back = partsToMetadata(parts);
  assert.equal(back.version, 5);
  assert.deepEqual(back.authorizations, {});
  assert.deepEqual(back.reviews, {});
  assert.deepEqual(back.testing, { "PMON-1": { ok: true } });
  assert.equal(
    partsToMetadata(metadataToParts({ ...doc(), reviews: { a: 1 } })).version,
    4,
  );
});

test("assigned option drops and ignores the part", () => {
  const parts = metadataToParts(doc(), { assigned: false });
  assert.ok(!parts.some((p) => p.key === "assigned"));
  const all = metadataToParts(doc());
  assert.deepEqual(partsToMetadata(all, { assigned: false }).assigned, {});
});

test("unknown parts and bad images throw", () => {
  assert.throws(
    () => partsToMetadata([{ key: "mystery", codec: "gzip-json", value: {} }]),
    /mystery/,
  );
  assert.throws(
    () =>
      metadataToParts({
        ...doc(),
        images: { "PMON-5": "data:image/png;base64,AAA" },
      }),
    /PMON-5/,
  );
});

test("metadataHash hashes the canonical JSON", async () => {
  const d = doc();
  const expected = JSON.stringify({
    version: 1,
    images: { "PMON-1": PNG, "PMON-2": GIF },
    orders: { "PMON-9": [], ROOT: ["PMON-2", "PMON-1"] },
    assigned: { "PMON-3": "In Development" },
  });
  assert.equal(await metadataHash(d), await sha256Hex(utf8(expected)));
});
