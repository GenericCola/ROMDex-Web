import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileSelection, remapSelection, toggleSelection } from "../../src/domain/work-selection";
import { siblingSelection, stageGroup, stageMove } from "../../src/domain/bulk-hierarchy";
import { hierarchySignature } from "../../src/domain/task-drop";
import { indexTree, materialize } from "../../src/domain/accepted/core.mjs";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import type { TaskItem } from "../../src/domain/types";
const item = (id: string, parentId: string | null = null): TaskItem => ({ id, parentId, summary: id, description: "", state: "To do", priority: "Normal", complexity: null, type: "Task", updated: 1, comments: [], commentCount: 0 });
const workspace = () => { const data = emptyWorkspace(); data.remote = [item("a"), item("b"), item("c"), item("d", "a")]; return data; };
test("selection ranges are visible-only, modifier-additive and remappable", () => {
  const visible = ["a", "b", "c", "d"];
  let state = toggleSelection({ ids: [], anchor: null }, "a", visible);
  state = toggleSelection(state, "c", visible, { shiftKey: true });
  assert.deepEqual(state.ids, ["a", "b", "c"]);
  state = toggleSelection(state, "d", visible);
  state = toggleSelection(state, "c", visible, { shiftKey: true, ctrlKey: true });
  assert.deepEqual(state.ids, ["a", "b", "c", "d"]);
  assert.deepEqual(reconcileSelection(state, ["a", "b"]), { ids: ["a", "b"], anchor: null });
  assert.deepEqual(remapSelection({ ids: ["local-a"], anchor: "local-a" }, { "local-a": "PMON-1" }), { ids: ["PMON-1"], anchor: "PMON-1" });
});
test("grouping retains sibling order, stages parent before child edits and does not alter native snapshot", () => {
  const data = workspace(); data.order = { a: 2, b: 0, c: 1 }; const original = structuredClone(data.remote);
  const id = stageGroup(data, ["a", "c"], "Group", hierarchySignature(data));
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  assert.deepEqual(tree.children.get(null)?.map((x) => x.id), ["b", id]);
  assert.deepEqual(tree.children.get(id)?.map((x) => x.id), ["c", "a"]);
  assert.equal(data.operations[0]?.type, "create");
  assert.equal(data.operations.length, 3);
  assert.deepEqual(data.remote, original);
});
test("bulk moves preserve selected visual order and reject non-siblings or descendant targets atomically", () => {
  const data = workspace(); const original = structuredClone(data);
  assert.throws(() => stageMove(data, ["a", "b"], "d", null, hierarchySignature(data)), /itself|descendant/i);
  assert.deepEqual(data, original);
  assert.throws(() => siblingSelection(data.remote, data.order, ["b", "d"]), /Same Parent/);
  stageMove(data, ["c", "b"], "a", null, hierarchySignature(data));
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  assert.deepEqual(tree.children.get("a")?.map((x) => x.id), ["d", "b", "c"]);
});
test("stale grouping or blank names leave complete workspace untouched", () => {
  const data = workspace(); const before = structuredClone(data);
  assert.throws(() => stageGroup(data, ["a", "b"], " ", hierarchySignature(data)), /Parent Title/);
  assert.deepEqual(data, before);
  assert.throws(() => stageGroup(data, ["a", "b"], "Group", "stale"), /hierarchy changed/);
  assert.deepEqual(data, before);
});

import { editTask } from "../../src/domain/task-actions";
test("grouping never coalesces its new-parent reference into an earlier unsent edit", () => {
  const data = workspace();
  editTask(data, "a", { description: "pending note" });
  const id = stageGroup(data, ["a", "b"], "New parent", hierarchySignature(data));
  const createIndex = data.operations.findIndex((operation) => operation.type === "create" && operation.issueId === id);
  assert.equal(createIndex, 1);
  assert.equal(data.operations[0]?.type, "edit");
  if (data.operations[0]?.type === "edit") assert.equal(data.operations[0].patch.parentId, undefined);
  const dependent = data.operations.findIndex((operation) => operation.type === "edit" && operation.patch.parentId === id);
  assert.ok(dependent > createIndex);
});
