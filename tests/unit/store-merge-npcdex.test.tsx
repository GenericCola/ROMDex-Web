import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeValues } from "../../src/store/merge/merge";
import {
  flattenNpcdex,
  npcdexLayout,
  unflattenNpcdex,
  type NpcdexState,
} from "../../src/store/merge/npcdex-keys";

const D = {
  updatedAt: "2026-01-01",
  towns: [
    { id: "t-9", name: "Zed", pos: [1, 2] },
    { id: "t-1", name: "Alpha" },
    { id: "t-5", name: "Mid" },
  ],
  version: 3,
  annotations: { "t-9": { note: "x" }, "t-1": { note: "y" }, a: null },
  liveMappings: {},
  history: [
    { id: "h2", timestamp: "2026-01-01T00:00:00Z", text: "a" },
    { id: "h1", timestamp: "2026-01-02T00:00:00Z", text: "b" },
    { id: "h3", timestamp: "2026-01-02T00:00:00Z", text: "c" },
    { id: "h4", text: "no stamp" },
  ],
  changeDrafts: [],
  changePlans: { zeta: { steps: [1] }, alpha: { steps: [] } },
  settings: { z: 1, a: 2 },
};
const drafts = { "t-1": { name: "draft" }, "t-9": { name: "d9" } };
const history = [
  { id: "d1", at: "2026-02-01", what: 2 },
  { id: "d2", at: "2026-02-02", what: 1 },
];

test("document, drafts and history round trip exactly", () => {
  const state: NpcdexState = { document: D, drafts, history };
  const back = unflattenNpcdex(flattenNpcdex(state), npcdexLayout(D));
  assert.equal(JSON.stringify(back.document), JSON.stringify(D));
  assert.deepEqual(back.drafts, drafts);
  assert.deepEqual(back.history, history);
});

test("flatten uses the documented keys and markers", () => {
  const flat = flattenNpcdex({ document: D, drafts, history });
  for (const key of [
    "town/t-9",
    "annotations/a",
    "plans/zeta",
    "history/h1",
    "root/version",
    "root/liveMappings",
    "root/changeDrafts",
    "drafts/t-1",
    "drafthistory/d2",
    "field/towns",
    "field/annotations",
    "field/changePlans",
    "field/history",
  ])
    assert.ok(Object.hasOwn(flat, key), key);
  assert.equal(flat["field/towns"], true);
});

test("empty containers survive through markers", () => {
  const E = { towns: [], annotations: {}, changePlans: {}, history: [] };
  const back = unflattenNpcdex(
    flattenNpcdex({ document: E, drafts: {}, history: [] }),
    npcdexLayout(E),
  );
  assert.equal(JSON.stringify(back.document), JSON.stringify(E));
});

test("null document yields no document keys and null back", () => {
  const flat = flattenNpcdex({ document: null, drafts: { a: 1 }, history: [] });
  assert.deepEqual(Object.keys(flat), ["drafts/a"]);
  const back = unflattenNpcdex(flat, npcdexLayout(null));
  assert.equal(back.document, null);
  assert.deepEqual(back.drafts, { a: 1 });
});

test("irregular containers fall back to root keys", () => {
  const odd = {
    towns: [{ id: "a" }, { id: "a" }],
    annotations: [1],
    changePlans: "x",
    history: [{ note: 1 }],
  };
  const flat = flattenNpcdex({ document: odd, drafts: {}, history: [] });
  assert.deepEqual(Object.keys(flat).sort(), [
    "root/annotations",
    "root/changePlans",
    "root/history",
    "root/towns",
  ]);
  const back = unflattenNpcdex(flat, npcdexLayout(odd));
  assert.equal(JSON.stringify(back.document), JSON.stringify(odd));
});

test("new towns and keys follow layout then sorted order", () => {
  const flat = {
    "field/towns": true,
    "town/t-b": { id: "t-b" },
    "town/t-a": { id: "t-a" },
    "town/t-1": { id: "t-1" },
    "root/zz": 1,
    "root/aa": 2,
    "root/version": 3,
  };
  const back = unflattenNpcdex(flat, {
    keys: ["version", "towns"],
    towns: ["t-9", "t-1"],
  });
  assert.deepEqual(Object.keys(back.document ?? {}), [
    "version",
    "towns",
    "aa",
    "zz",
  ]);
  assert.deepEqual(
    (back.document?.["towns"] as { id: string }[]).map((t) => t.id),
    ["t-1", "t-a", "t-b"],
  );
});

test("history sorts by timestamp then id and draft history by at", () => {
  const back = unflattenNpcdex(
    {
      "field/history": true,
      "history/b": { id: "b", timestamp: "2" },
      "history/a": { id: "a", timestamp: "2" },
      "history/n": { id: "n" },
      "history/c": { id: "c", timestamp: "1" },
      "drafthistory/y": { id: "y", at: "1" },
      "drafthistory/x": { id: "x", at: "1" },
      "drafthistory/w": { id: "w", at: "0" },
    },
    { keys: [], towns: [] },
  );
  assert.deepEqual(
    (back.document?.["history"] as { id: string }[]).map((h) => h.id),
    ["c", "a", "b", "n"],
  );
  assert.deepEqual(
    (back.history as { id: string }[]).map((h) => h.id),
    ["w", "x", "y"],
  );
});

test("merging two town edits through keys keeps both", () => {
  const base = flattenNpcdex({ document: D, drafts: {}, history: [] });
  const localDoc = {
    ...D,
    towns: [{ ...D.towns[0], name: "L" }, ...D.towns.slice(1)],
  };
  const remoteDoc = {
    ...D,
    towns: [D.towns[0], { ...D.towns[1], name: "R" }, D.towns[2]],
  };
  const result = mergeValues(
    base,
    flattenNpcdex({ document: localDoc, drafts: {}, history: [] }),
    flattenNpcdex({ document: remoteDoc, drafts: {}, history: [] }),
  );
  assert.deepEqual(result.conflicts, []);
  const out = unflattenNpcdex(result.merged, npcdexLayout(D)).document;
  assert.deepEqual(
    (out?.["towns"] as { name: string }[]).map((t) => t.name),
    ["L", "R", "Mid"],
  );
});
