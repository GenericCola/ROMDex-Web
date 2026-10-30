import assert from "node:assert/strict";
import test from "node:test";
import {
  deletionSnapshot,
  queueReviewedDeletion,
} from "../../src/domain/reviewed-deletion";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const task = (id: string, parentId: string | null = null): TaskItem => {
  return {
    id,
    parentId,
    summary: id,
    description: "",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
};
void test("deletion cannot include a child added after its exact list was reviewed", () => {
  const data = emptyWorkspace();
  data.remote = [task("PMON-1")];
  const reviewed = deletionSnapshot(data.remote, "PMON-1");
  data.remote.push(task("PMON-2", "PMON-1"));
  assert.throws(() => {
    return queueReviewedDeletion(data, "PMON-1", reviewed);
  }, /changed/);
  assert.equal(data.operations.length, 0);
});
void test("unchanged reviewed deletion stages only the listed tasks", () => {
  const data = emptyWorkspace();
  data.remote = [task("PMON-1"), task("PMON-2", "PMON-1"), task("PMON-3")];
  queueReviewedDeletion(
    data,
    "PMON-1",
    deletionSnapshot(data.remote, "PMON-1"),
  );
  assert.equal(data.operations[0]?.type, "delete");
  if (data.operations[0]?.type === "delete")
    assert.deepEqual(data.operations[0].ids, ["PMON-1", "PMON-2"]);
});
