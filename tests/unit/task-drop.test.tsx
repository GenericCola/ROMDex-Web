import assert from "node:assert/strict";
import { test } from "node:test";
import { indexTree, materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import {
  applyTaskDrop,
  hierarchySignature,
  rowDropTarget,
} from "../../src/domain/task-drop";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const fixture = () => {
  const data = emptyWorkspace();
  const a = createTask(data, null, "A"),
    b = createTask(data, null, "B"),
    c = createTask(data, b, "C");
  return { data, a, b, c };
};
void test("desktop drop geometry nests, outdents and anchors after expanded descendants", () => {
  const { data, a, b, c } = fixture(),
    items = materialize(data.remote, data.operations);
  const after = rowDropTarget(
    items,
    data.order,
    { dragId: a, targetId: b, delta: 0, after: true },
    [a, b, c],
  );
  assert.equal(after?.anchorId, c);
  assert.equal(after?.parentId, null);
  assert.equal(
    rowDropTarget(
      items,
      data.order,
      { dragId: a, targetId: b, delta: 1, after: false },
      [a, b, c],
    )?.parentId,
    b,
  );
  assert.equal(
    rowDropTarget(
      items,
      data.order,
      { dragId: a, targetId: c, delta: -1, after: false },
      [a, b, c],
    )?.parentId,
    null,
  );
  assert.throws(() => {
    return rowDropTarget(
      items,
      data.order,
      { dragId: b, targetId: c, delta: 1, after: true },
      [a, b, c],
    );
  }, /descendants/);
  assert.throws(() => {
    return rowDropTarget(
      items,
      data.order,
      { dragId: a, targetId: c, delta: Infinity, after: true },
      [a, b, c],
    );
  }, /level/);
});
void test("reorder keeps queue unchanged; reparent uses existing operation safeguards", () => {
  const { data, a, b } = fixture();
  const before = JSON.stringify(data.operations);
  applyTaskDrop(
    data,
    { dragId: a, targetId: b, delta: 0, after: true },
    hierarchySignature(data),
  );
  assert.equal(JSON.stringify(data.operations), before);
  assert.deepEqual(
    indexTree(materialize(data.remote, data.operations), data.order)
      .children.get(null)
      ?.map((item) => {
        return item.id;
      }),
    [b, a],
  );
  applyTaskDrop(
    data,
    { dragId: a, targetId: b, delta: 1, after: true },
    hierarchySignature(data),
  );
  assert.equal(
    materialize(data.remote, data.operations).find((item) => {
      return item.id === a;
    })?.parentId,
    b,
  );
  assert.ok(data.view.expanded.includes(b));
});
void test("stale hierarchy and invalid descendant moves never mutate data", () => {
  const { data, a, b, c } = fixture(),
    signature = hierarchySignature(data);
  data.order[a] = 12;
  const before = JSON.stringify(data);
  assert.throws(() => {
    return applyTaskDrop(
      data,
      { dragId: a, targetId: b, delta: 0, after: true },
      signature,
    );
  }, /changed/);
  assert.throws(() => {
    return applyTaskDrop(
      data,
      { dragId: b, targetId: c, delta: 1, after: true },
      hierarchySignature(data),
    );
  }, /descendants/);
  assert.equal(JSON.stringify(data), before);
});
void test("selector destinations append under their tile and reject descendant cycles", () => {
  const { data, a, b, c } = fixture();
  const intent = { dragId: a, targetId: b, delta: 1, after: true };
  const target = rowDropTarget(
    materialize(data.remote, data.operations),
    data.order,
    intent,
    [],
  );
  assert.equal(target?.parentId, b);
  assert.equal(target?.beforeId, null);
  applyTaskDrop(data, intent, hierarchySignature(data));
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  assert.deepEqual(
    tree.children.get(b)?.map((item) => {
      return item.id;
    }),
    [c, a],
  );
  const before = JSON.stringify(data);
  assert.throws(() => {
    return applyTaskDrop(
      data,
      { dragId: b, targetId: c, delta: 1, after: true },
      hierarchySignature(data),
    );
  });
  assert.equal(JSON.stringify(data), before);
});
