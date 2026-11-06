import assert from "node:assert/strict";
import test from "node:test";
import { dragDepthDelta } from "../../src/components/romdex/task-drag-preview";
import { indexTree, materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import { applyTaskDrop, hierarchySignature, rowDropTarget } from "../../src/domain/task-drop";
import { exactMoveIntent } from "../../src/domain/task-move";
import { emptyWorkspace } from "../../src/domain/workspace-data";

test("sideways precision has a full-step dead zone in both directions", () => {
  for (const distance of [-25, -13, -1, 0, 1, 13, 25]) assert.equal(dragDepthDelta(distance), 0);
  for (const distance of [26, 51, 52, 78]) {
    assert.equal(dragDepthDelta(distance), Math.floor(distance / 26));
    assert.equal(dragDepthDelta(-distance), -Math.floor(distance / 26));
  }
});

test("exact move inserts before first child, between siblings, at end and back to root", () => {
  const data = emptyWorkspace();
  const root = createTask(data, null, "Root");
  const moving = createTask(data, null, "Moving");
  const child = createTask(data, root, "First");
  const next = createTask(data, root, "Second");
  data.order[child] = 0;
  data.order[next] = 1;
  const move = (parent: string | null, before: string | null) => {
    const intent = exactMoveIntent(data, moving, parent, before);
    assert.ok(intent);
    const preview = rowDropTarget(materialize(data.remote, data.operations), data.order, intent, [root, child, next, moving]);
    assert.equal(preview?.parentId, parent);
    applyTaskDrop(data, intent, hierarchySignature(data));
    const tree = indexTree(materialize(data.remote, data.operations), data.order);
    assert.equal(tree.byId.get(moving)?.parentId, parent);
    return tree.children.get(parent)?.map((item) => item.id);
  };
  assert.deepEqual(move(root, child), [moving, child, next]);
  assert.deepEqual(move(root, next), [child, moving, next]);
  assert.deepEqual(move(root, null), [child, next, moving]);
  assert.deepEqual(move(null, root), [moving, root]);
  assert.deepEqual(move(null, null), [root, moving]);
});

test("exact moves reject cycles, wrong-parent boundaries and stale hierarchy without mutation", () => {
  const data = emptyWorkspace();
  const root = createTask(data, null, "Root");
  const child = createTask(data, root, "Child");
  const other = createTask(data, null, "Other");
  const before = structuredClone(data);
  assert.throws(() => exactMoveIntent(data, root, child, null), /descendants/);
  assert.throws(() => exactMoveIntent(data, other, root, other), /insertion target/);
  assert.deepEqual(data, before);
  const intent = exactMoveIntent(data, other, root, child);
  const signature = hierarchySignature(data);
  assert.ok(intent);
  data.order[root] = 50;
  const changed = structuredClone(data);
  assert.throws(() => applyTaskDrop(data, intent, signature), /hierarchy changed/);
  assert.deepEqual(data, changed);
});

test("the only root can stay at root without fabricating a target", () => {
  const data = emptyWorkspace();
  const root = createTask(data, null, "Only");
  assert.equal(exactMoveIntent(data, root, null, null), null);
});
