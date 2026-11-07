import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeValues,
  sameValue,
  stableJson,
} from "../../src/store/merge/merge";
import {
  flattenMetadata,
  unflattenMetadata,
  type RomdexMetadata,
} from "../../src/store/merge/romdex-keys";

test("stableJson sorts keys recursively and sameValue handles absence", () => {
  assert.equal(
    stableJson({ b: 1, a: { d: 1, c: [{ y: 1, x: 2 }] } }),
    stableJson({ a: { c: [{ x: 2, y: 1 }], d: 1 }, b: 1 }),
  );
  assert.equal(sameValue(undefined, undefined), true);
  assert.equal(sameValue(undefined, null), false);
  assert.equal(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(sameValue([1, 2], [2, 1]), false);
});

test("unchanged local takes remote, unchanged remote takes local", () => {
  const base = { a: 1, b: 1, c: 1 };
  const result = mergeValues(base, { a: 1, b: 2, c: 1 }, { a: 5, b: 1, c: 1 });
  assert.deepEqual(result.merged, { a: 5, b: 2, c: 1 });
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.toRemote, ["b"]);
  assert.deepEqual(result.toLocal, ["a"]);
});

test("identical changes on both sides merge without upload or apply", () => {
  const result = mergeValues(
    { a: 1 },
    { a: { x: 1, y: 2 } },
    { a: { y: 2, x: 1 } },
  );
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.toRemote, []);
  assert.deepEqual(result.toLocal, []);
});

test("different edits conflict and keep remote", () => {
  const result = mergeValues({ a: 1 }, { a: 2 }, { a: 3 });
  assert.deepEqual(result.merged, { a: 3 });
  assert.deepEqual(result.conflicts, [
    { key: "a", base: 1, local: 2, remote: 3 },
  ]);
  assert.deepEqual(result.toRemote, []);
  assert.deepEqual(result.toLocal, ["a"]);
});

test("removal versus unchanged removes, removal versus edit conflicts", () => {
  const removedLocal = mergeValues({ a: 1 }, {}, { a: 1 });
  assert.deepEqual(removedLocal.merged, {});
  assert.deepEqual(removedLocal.toRemote, ["a"]);
  const removedRemote = mergeValues({ a: 1 }, { a: 1 }, {});
  assert.deepEqual(removedRemote.merged, {});
  assert.deepEqual(removedRemote.toLocal, ["a"]);

  const editVsRemoval = mergeValues({ a: 1 }, { a: 2 }, {});
  assert.deepEqual(editVsRemoval.merged, {});
  assert.deepEqual(editVsRemoval.conflicts, [{ key: "a", base: 1, local: 2 }]);
  const removalVsEdit = mergeValues({ a: 1 }, {}, { a: 2 });
  assert.deepEqual(removalVsEdit.merged, { a: 2 });
  assert.deepEqual(removalVsEdit.conflicts, [{ key: "a", base: 1, remote: 2 }]);
  const bothRemoved = mergeValues({ a: 1 }, {}, {});
  assert.deepEqual(bothRemoved.conflicts, []);
});

test("additions on one side or both sides", () => {
  const result = mergeValues(
    {},
    { l: 1, same: 1, clash: 1 },
    { r: 1, same: 1, clash: 2 },
  );
  assert.deepEqual(result.merged, { l: 1, r: 1, same: 1, clash: 2 });
  assert.deepEqual(result.conflicts, [{ key: "clash", local: 1, remote: 2 }]);
  assert.deepEqual(result.toRemote, ["l"]);
  assert.deepEqual(result.toLocal, ["clash", "r"]);
});

test("null values are real values, not absence", () => {
  const result = mergeValues({ a: null }, { a: null }, {});
  assert.deepEqual(result.merged, {});
  assert.deepEqual(result.toLocal, ["a"]);
});

test("first sync without a base keeps local-only keys and prefers remote", () => {
  const result = mergeValues(
    null,
    { mine: 1, both: 1 },
    { theirs: 1, both: 2 },
  );
  assert.deepEqual(result.merged, { mine: 1, theirs: 1, both: 2 });
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.toRemote, ["mine"]);
  assert.deepEqual(result.toLocal, ["both", "theirs"]);
});

test("conflicts are sorted by key", () => {
  const result = mergeValues({ b: 0, a: 0 }, { b: 1, a: 1 }, { b: 2, a: 2 });
  assert.deepEqual(
    result.conflicts.map((c) => c.key),
    ["a", "b"],
  );
});

const doc: RomdexMetadata = {
  version: 1,
  images: { "PMON-12": "img" },
  orders: { ROOT: ["PMON-2", "PMON-1"], "PMON-16": ["PMON-18", "PMON-17"] },
  assigned: { "PMON-2": "Done" },
};

test("ROMDex flatten uses field prefixes and round trips", () => {
  const flat = flattenMetadata(doc);
  assert.deepEqual(Object.keys(flat).sort(), [
    "assigned/PMON-2",
    "image/PMON-12",
    "orders/PMON-16",
    "orders/ROOT",
  ]);
  assert.deepEqual(unflattenMetadata(flat), doc);
});

test("ROMDex versions follow the highest non-empty field", () => {
  const full: RomdexMetadata = {
    ...doc,
    version: 5,
    authorizations: { h1: 1 },
    acceptances: { h2: 1 },
    reviews: { h3: 1 },
    testing: { h4: 1 },
  };
  assert.deepEqual(unflattenMetadata(flattenMetadata(full)), full);
  const v2 = unflattenMetadata({ "authorizations/x": 1 });
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.authorizations, { x: 1 });
  assert.equal("acceptances" in v2, false);
  assert.equal(unflattenMetadata({ "reviews/x": 1 }).version, 4);
  assert.equal(unflattenMetadata({ "acceptances/x": 1 }).version, 3);
  assert.deepEqual(
    Object.keys(unflattenMetadata({ "orders/b": [], "orders/a": [] }).orders),
    ["a", "b"],
  );
  assert.throws(() => unflattenMetadata({ "bogus/x": 1 }));
});

test("two devices reordering different children of one parent conflict once", () => {
  const base = flattenMetadata(doc);
  const a = flattenMetadata({
    ...doc,
    orders: { ...doc.orders, ROOT: ["PMON-1", "PMON-2"] },
  });
  const b = flattenMetadata({
    ...doc,
    orders: {
      ...doc.orders,
      "PMON-16": ["PMON-17", "PMON-18"],
      ROOT: ["PMON-2", "PMON-3", "PMON-1"],
    },
  });
  const result = mergeValues(base, a, b);
  assert.deepEqual(
    result.conflicts.map((c) => c.key),
    ["orders/ROOT"],
  );
  assert.deepEqual(result.merged["orders/ROOT"], [
    "PMON-2",
    "PMON-3",
    "PMON-1",
  ]);
  assert.deepEqual(result.merged["orders/PMON-16"], ["PMON-17", "PMON-18"]);
});
