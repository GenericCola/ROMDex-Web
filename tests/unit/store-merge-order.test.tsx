import assert from "node:assert/strict";
import { test } from "node:test";
import type { TaskItem } from "../../src/domain/types";
import { captureOrders, projectOrders } from "../../src/store/merge/order";

const item = (id: string, parentId: string | null = null): TaskItem =>
  ({
    id,
    parentId,
    summary: id,
    description: "",
    state: "Open",
  }) as unknown as TaskItem;

const items = [
  item("P-1"),
  item("P-2"),
  item("P-3", "P-1"),
  item("P-4", "P-1"),
  item("P-5", "P-1"),
  item("P-10"),
];

test("positions become ordered lists for parents with any entry", () => {
  const orders = captureOrders(items, {
    "P-2": 0,
    "P-1": 1,
    "P-5": 0,
    "P-3": 1,
  });
  assert.deepEqual(orders, {
    ROOT: ["P-2", "P-1", "P-10"],
    "P-1": ["P-5", "P-3", "P-4"],
  });
  assert.deepEqual(captureOrders(items, {}), {});
});

test("lists round trip back to positions", () => {
  const orders = { ROOT: ["P-10", "P-2", "P-1"], "P-1": ["P-5", "P-4", "P-3"] };
  const positions = projectOrders(orders, items, {}, {});
  assert.deepEqual(positions, {
    "P-10": 0,
    "P-2": 1,
    "P-1": 2,
    "P-5": 0,
    "P-4": 1,
    "P-3": 2,
  });
  assert.deepEqual(captureOrders(items, positions), orders);
});

test("an already natural order produces no positions", () => {
  assert.deepEqual(
    projectOrders({ ROOT: ["P-1", "P-2", "P-10"] }, items, {}, {}),
    {},
  );
});

test("siblings missing from the list are appended and unknown ids ignored", () => {
  const positions = projectOrders({ "P-1": ["P-5", "GONE-1"] }, items, {}, {});
  assert.deepEqual(positions, { "P-5": 0, "P-3": 1, "P-4": 2 });
});

test("a parent dropped from orders clears its children's positions", () => {
  const current = { "P-3": 2, "P-4": 1, "P-2": 0 };
  const next = projectOrders({}, items, current, { "P-1": ["P-4", "P-3"] });
  assert.deepEqual(next, { "P-2": 0 });
});
