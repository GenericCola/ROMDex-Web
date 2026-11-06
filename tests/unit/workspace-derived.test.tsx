import assert from "node:assert/strict";
import { test } from "node:test";
import { descendants } from "../../src/domain/accepted/core.mjs";
import { createTask, editTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import {
  subtreeIds,
  workspaceItems,
  workspaceTree,
} from "../../src/domain/workspace-derived";
const fixture = () => {
  const data = emptyWorkspace();
  const a = createTask(data, null, "A"),
    b = createTask(data, a, "B"),
    c = createTask(data, b, "C"),
    d = createTask(data, a, "D"),
    e = createTask(data, null, "E");
  return { data, a, b, c, d, e };
};
test("the same snapshot returns the same items array", () => {
  const { data } = fixture();
  const first = workspaceItems(data);
  assert.equal(workspaceItems(data), first);
  assert.equal(workspaceItems({ ...data }), first);
  assert.equal(first.length, 5);
});
test("a change to one task keeps the other items' identity", () => {
  const { data, b, c } = fixture();
  const before = workspaceItems(data);
  const next = structuredClone(data);
  editTask(next, b, { summary: "Renamed" });
  const after = workspaceItems(next);
  assert.notEqual(after, before);
  for (const item of after) {
    const old = before.find((entry) => {
      return entry.id === item.id;
    });
    if (item.id === b) {
      assert.notEqual(item, old);
      assert.equal(item.summary, "Renamed");
    } else assert.equal(item, old, item.id);
  }
  assert.ok(after.some((item) => item.id === c));
});
test("an equal re-materialization returns the previous array", () => {
  const { data } = fixture();
  const before = workspaceItems(data);
  const copy = structuredClone(data);
  assert.equal(workspaceItems(copy), before);
});
test("the tree is cached per items array and order identity", () => {
  const { data } = fixture();
  const items = workspaceItems(data);
  const tree = workspaceTree(items, data.order);
  assert.equal(workspaceTree(items, data.order), tree);
  const other = { ...data.order };
  const rebuilt = workspaceTree(items, other);
  assert.notEqual(rebuilt, tree);
  assert.equal(workspaceTree(items, other), rebuilt);
});
test("subtreeIds matches descendants on a three-level fixture", () => {
  const { data, a, b, c, d, e } = fixture();
  const items = workspaceItems(data);
  const tree = workspaceTree(items, data.order);
  for (const id of [a, b, c, d, e])
    assert.deepEqual(subtreeIds(tree, id), descendants(items, id));
  assert.equal(subtreeIds(tree, a).length, 3);
});
test("a parent cycle still throws and caches nothing", () => {
  const { data, a, b } = fixture();
  const items = workspaceItems(data).map((item) => {
    return item.id === a ? { ...item, parentId: b } : item;
  });
  assert.throws(() => workspaceTree(items, data.order));
  assert.throws(() => workspaceTree(items, data.order));
});
