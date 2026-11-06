import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { npcdexBinding } from "../../src/store/browser/npcdex-binding";

const document = {
  schema: 1,
  towns: [{ id: "t1", name: "One" }],
  annotations: { a: { text: "x" } },
};

test("a workspace without NPCDex never removes it", () => {
  const data = emptyWorkspace();
  const base = {
    "root/schema": 1,
    "field/towns": true,
    "town/t1": { id: "t1" },
  };
  const local = npcdexBinding.local(data, base, {});
  assert.deepEqual(local, base);
  assert.deepEqual(npcdexBinding.local(data, null, base), base);
});

test("local to parts to remote round trips with drafts", async () => {
  const data = emptyWorkspace();
  data.npcdex = document;
  data.npcdexDrafts = { k: { v: 1 } } as never;
  data.npcdexHistory = [{ id: "h1", at: "2026-01-01" }];
  const local = npcdexBinding.local(data, null, {});
  const parts = await npcdexBinding.parts(local, [], data);
  assert.deepEqual(npcdexBinding.remote(parts), local);
  assert.deepEqual(await npcdexBinding.parts({}, [], emptyWorkspace()), []);
});

test("apply writes the document and drafts", async () => {
  const source = emptyWorkspace();
  source.npcdex = document;
  source.npcdexDrafts = { k: { v: 1 } } as never;
  const flat = npcdexBinding.local(source, null, {});
  const parts = await npcdexBinding.parts(flat, [], source);
  const target = emptyWorkspace();
  const held = npcdexBinding.apply(target, flat, Object.keys(flat), parts);
  assert.deepEqual(held, []);
  assert.deepEqual(target.npcdex, document);
  assert.deepEqual(target.npcdexDrafts, { k: { v: 1 } });
  const removed = npcdexBinding.apply(target, {}, ["annotations/a"], parts);
  assert.deepEqual(removed, []);
  assert.deepEqual(target.npcdex?.["annotations"], {});
});
