import assert from "node:assert/strict";
import test from "node:test";
import {
  guardHierarchyRecovery,
  HierarchyRecoveryConflict,
} from "./hierarchy-recovery.ts";
test("incident guard isolates account and Subtask, not duplicate aggregation", async () => {
  const path = ["issues", "PMON-1", "links", "80-3t", "issues"];
  const read = async () => [{ id: "80-3t", linkType: { name: "Subtask" } }];
  await assert.rejects(
    guardHierarchyRecovery("2-2", path, read),
    HierarchyRecoveryConflict,
  );
  await guardHierarchyRecovery("other", path, read);
  await guardHierarchyRecovery("2-2", ["issues", "PMON-1"], async () => {
    throw Error("unexpected read");
  });
  await guardHierarchyRecovery("2-2", path, async () => [
    { id: "80-3t", linkType: { name: "Duplicate", aggregation: true } },
  ]);
});
