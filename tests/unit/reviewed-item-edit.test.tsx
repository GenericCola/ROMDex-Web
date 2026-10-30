import assert from "node:assert/strict";
import test from "node:test";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { reviewedItemEdit } from "../../src/domain/reviewed-item-edit";
import { createTask, editTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
void test("restored item dialog applies only reviewed supported fields and keeps current status semantics", () => {
  const data = emptyWorkspace();
  const id = createTask(data, null, "Original");
  reviewedItemEdit(
    data,
    id,
    { summary: "Updated", assignedState: "Awaiting Testing" },
    { summary: "Original", assignedState: "To do" },
  );
  const item = materialize(data.remote, data.operations)[0];
  assert.equal(item?.summary, "Updated");
  assert.equal(item?.assignedState, "Awaiting Testing");
});
void test("item editor refuses stale fields and unadapted native field mutations without changing queue", () => {
  const data = emptyWorkspace();
  const id = createTask(data, null, "Original");
  editTask(data, id, { summary: "Other edit" });
  const before = JSON.stringify(data);
  assert.throws(() => {
    return reviewedItemEdit(
      data,
      id,
      { summary: "Draft" },
      { summary: "Original" },
    );
  }, /changed while editing/);
  const unsupported = JSON.parse('{"assignee":"1-1"}') as Parameters<
    typeof reviewedItemEdit
  >[2];
  assert.throws(() => {
    return reviewedItemEdit(data, id, unsupported, {});
  }, /web delivery adapter/);
  assert.equal(JSON.stringify(data), before);
});
