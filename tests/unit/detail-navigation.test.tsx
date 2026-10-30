import assert from "node:assert/strict";
import test from "node:test";
import { DetailNavigation } from "../../src/domain/accepted/detail-navigation.mjs";
void test("original Details Back follows viewed child trail rather than changed native parents", () => {
  const navigation = new DetailNavigation();
  const items = new Map<string, unknown>([
    ["a", {}],
    ["b", {}],
    ["c", {}],
  ]);
  navigation.open(null, "a");
  navigation.open("a", "b", true);
  navigation.open("b", "c", true);
  assert.equal(navigation.back(items), "b");
  items.delete("a");
  assert.equal(navigation.back(items), null);
  navigation.open("b", "c", true);
  navigation.open("c", "a");
  assert.equal(navigation.destination(items), null);
});
void test("temporary task receipt mapping preserves Details history", () => {
  const navigation = new DetailNavigation();
  navigation.open("local-a", "b", true);
  navigation.remap({ "local-a": "PMON-1" });
  assert.equal(navigation.back(new Map([["PMON-1", {}]])), "PMON-1");
});
