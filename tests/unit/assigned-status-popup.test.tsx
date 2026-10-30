import assert from "node:assert/strict";
import { test } from "node:test";
import { assignTaskStatus } from "../../src/domain/assigned-status";
import { indexTree, materialize, STATES, STATUS } from "../../src/domain/accepted/core.mjs";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import type { TaskItem } from "../../src/domain/types";
const item = (id: string, parentId: string | null = null): TaskItem => ({ id, parentId, summary: id, description: "", state: "To do", priority: "Normal", complexity: null, type: "Task", updated: 1, comments: [], commentCount: 0 });
test("status popup queues assigned status without replacing native state or child rollup", () => {
  const data = emptyWorkspace(); data.remote = [item("PMON-1"), { ...item("PMON-2", "PMON-1"), state: "Done" }];
  const cloudBefore = structuredClone(data.cloud);
  assignTaskStatus(data, "PMON-1", "amber", "To do");
  const projected = materialize(data.remote, data.operations);
  assert.equal(projected[0]?.assignedState, STATES.amber);
  assert.equal(projected[0]?.state, "To do");
  assert.equal(indexTree(projected, {}).colors.get("PMON-1"), "green");
  assert.deepEqual(data.cloud, cloudBefore);
});
test("status popup refuses stale or missing targets and retains existing choices", () => {
  const data = emptyWorkspace(); data.remote = [item("PMON-1")];
  assignTaskStatus(data, "PMON-1", "blue", "To do");
  assert.throws(() => assignTaskStatus(data, "PMON-1", "green", "To do"), /changed/);
  assert.throws(() => assignTaskStatus(data, "missing", "green", "To do"), /no longer exists/);
  assert.equal(materialize(data.remote, data.operations)[0]?.assignedState, STATES.blue);
});
test("status options preserve accepted testing order and display labels", () => {
  assert.deepEqual(Object.keys(STATUS), ["grey", "yellow", "blue", "purple", "amber", "green", "red"]);
  assert.equal(STATUS.amber, "Awaiting Testing");
  assert.equal(STATUS.red, "Debugging");
});
