import assert from "node:assert/strict";
import { test } from "node:test";
import { npcdexToParts, partsToNpcdex } from "../../src/store/parts/index.ts";

const PNG_A = "data:image/png;base64,iVBORw0KGgoAAQI=";
const GIF_B = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const LOOSE = "data:image/png;base64,iVBORw0KGgoAAQJ=";

const fixture = (): Record<string, unknown> => ({
  zeta: { deep: [1, { z: null }] },
  towns: [
    { id: "b", name: "B", img: PNG_A, nested: { list: [GIF_B] } },
    { id: "a", name: "A", img: LOOSE },
    { id: "c", name: "C" },
  ],
  history: [{ id: "h1", before: { pic: PNG_A }, timestamp: 1 }],
  version: 2,
  annotations: { k: { pic: GIF_B, text: "hi" } },
  changePlans: { p: [] },
  alpha: "text",
});

test("npcdex document round trips byte for byte", async () => {
  const doc = fixture();
  const parts = await npcdexToParts(doc);
  const images = parts.filter((p) => p.key.startsWith("image/"));
  assert.equal(images.length, 2);
  assert.deepEqual(
    parts.map((p) => p.key).filter((k) => !k.startsWith("image/")),
    ["root", "town/b", "town/a", "town/c", "history", "annotations", "plans"],
  );
  const back = partsToNpcdex(parts);
  assert.equal(JSON.stringify(back.document), JSON.stringify(doc));
  assert.equal(back.drafts, null);
  const town = parts.find((p) => p.key === "town/a");
  assert.ok(town && town.codec === "gzip-json");
  assert.match(JSON.stringify(town.value), /iVBORw0KGgoAAQJ=/);
});

test("drafts round trip", async () => {
  const drafts = { drafts: { x: { n: 1 } }, history: [{ id: "d" }] };
  const back = partsToNpcdex(await npcdexToParts(fixture(), drafts));
  assert.deepEqual(back.drafts, drafts);
});

test("invalid documents and parts throw", async () => {
  const dup = fixture();
  dup.towns = [{ id: "a" }, { id: "a" }];
  await assert.rejects(npcdexToParts(dup), /Duplicate/);
  const reserved = fixture();
  reserved.alpha = { $image: "x" };
  await assert.rejects(npcdexToParts(reserved), /reserved \$image/);
  await assert.rejects(npcdexToParts({ ...fixture(), towns: [{ id: "" }] }));
  const parts = await npcdexToParts(fixture());
  const noImage = parts.filter((p) => !p.key.startsWith("image/"));
  assert.throws(() => partsToNpcdex(noImage), /Missing part "image\//);
  assert.throws(
    () => partsToNpcdex(parts.filter((p) => p.key !== "town/c")),
    /town\/c/,
  );
  assert.throws(
    () =>
      partsToNpcdex([
        ...parts,
        { key: "mystery", codec: "gzip-json", value: 1 },
      ]),
    /mystery/,
  );
});
