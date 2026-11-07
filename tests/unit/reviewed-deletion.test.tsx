import assert from "node:assert/strict";
import test from "node:test";
import {
  deletionSnapshot,
  queueReviewedDeletion,
} from "../../src/domain/reviewed-deletion";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { taskItem as task } from "../fixtures/task-item";
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
