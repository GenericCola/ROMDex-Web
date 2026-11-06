import assert from "node:assert/strict";
import { test } from "node:test";
import { indexTree } from "../../src/domain/accepted/core.mjs";
import type { TaskItem } from "../../src/domain/types";
import { workspaceTree } from "../../src/domain/workspace-derived";
const make = (id: string, parentId: string | null, state = "To do") => {
  const item: TaskItem = {
    id,
    summary: id,
    description: "",
    parentId,
    state,
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: null,
    comments: [],
    commentCount: 0,
  };
  return item;
};
const base = (): TaskItem[] => {
  const items = [make("T-1", null), make("T-2", "T-1"), make("T-10", "T-1")];
  for (let i = 3; i < 9; i += 1) items.push(make(`T-${i + 20}`, "T-2"));
  items.push(make("T-99", null, "Done"));
  return items;
};
const check = (items: TaskItem[], order: Record<string, number>) => {
  const tree = workspaceTree(items, order);
  const want = indexTree(items, order);
  assert.deepEqual(tree, want);
  assert.deepEqual([...tree.children.keys()], [...want.children.keys()]);
  for (const [key, list] of want.children) {
    const got = tree.children.get(key) ?? [];
    assert.deepEqual(
      got.map((item) => item.id),
      list.map((item) => item.id),
    );
    got.forEach((item) => assert.equal(item, tree.byId.get(item.id)));
    got.forEach((item, i) =>
      assert.equal(
        item,
        items.find((x) => x.id === list[i]?.id),
      ),
    );
  }
  return tree;
};
test("a description-only change reuses depths and colors", () => {
  const order = { "T-10": 0, "T-2": 1 };
  const items = base();
  const first = check(items, order);
  const next = items.map((item) => {
    return item.id === "T-23" ? { ...item, description: "typed" } : item;
  });
  const second = check(next, order);
  assert.equal(second.depths, first.depths);
  assert.equal(second.colors, first.colors);
  assert.equal(second.byId.get("T-23")?.description, "typed");
});
test("an equal-content order object still reuses", () => {
  const items = base();
  const first = check(items, { "T-10": 0 });
  const next = items.map((item) => ({ ...item }));
  const second = check(next, { "T-10": 0 });
  assert.equal(second.depths, first.depths);
});
test("a state change falls back and recolours", () => {
  const order = {};
  const items = base();
  const first = check(items, order);
  const next = items.map((item) => {
    return item.id === "T-23" ? { ...item, state: "Done" } : item;
  });
  const second = check(next, order);
  assert.notEqual(second.colors, first.colors);
  assert.notEqual(second.colors.get("T-23"), first.colors.get("T-23"));
});
test("a changed order or parent falls back", () => {
  const items = base();
  check(items, { "T-2": 0 });
  check(items, { "T-10": 0, "T-2": 1 });
  const moved = items.map((item) => {
    return item.id === "T-23" ? { ...item, parentId: "T-10" } : item;
  });
  check(moved, { "T-10": 0, "T-2": 1 });
});
test("a cycle after a cached tree still throws", () => {
  const items = base();
  check(items, {});
  const cyclic = items.map((item) => {
    return item.id === "T-1" ? { ...item, parentId: "T-2" } : item;
  });
  assert.throws(() => workspaceTree(cyclic, {}));
});
