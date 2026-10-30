import assert from "node:assert/strict";
import { test } from "node:test";
import { HierarchyQuarantine } from "../../src/cloud/hierarchy-quarantine";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
test("reopen quarantine preserves all data and blocks pending parent changes", () => {
  const data = emptyWorkspace();
  data.operations.push({
    opId: "move",
    type: "edit",
    issueId: "PMON-1",
    base: {} as TaskItem,
    patch: { parentId: "PMON-2", summary: "keep draft" },
  });
  data.commentDrafts.keep = "unrelated";
  const before = JSON.stringify(data),
    guard = new HierarchyQuarantine();
  guard.capture(data);
  assert.equal(guard.blocked(data), true);
  assert.throws(() => guard.assertSafe(data), /quarantined/);
  assert.equal(JSON.stringify(data), before);
  data.operations = [];
  guard.assertSafe(data);
});
test("new deliberate desktop moves in an already open session are unchanged", () => {
  const data = emptyWorkspace(),
    guard = new HierarchyQuarantine();
  guard.capture(data);
  data.operations.push({
    opId: "new",
    type: "edit",
    issueId: "PMON-1",
    base: {} as TaskItem,
    patch: { parentId: null },
  });
  guard.assertSafe(data);
});
test("quarantine survives operation replacement and reconnect with Auto-Sync off", () => {
  const data = emptyWorkspace(),
    guard = new HierarchyQuarantine();
  data.cloud = { autoSync: false, records: {} };
  data.operations.push({
    opId: "old",
    type: "edit",
    issueId: "PMON-1",
    base: {} as TaskItem,
    patch: { parentId: "PMON-2" },
  });
  guard.capture(data);
  data.operations[0]!.opId = "replacement";
  assert.throws(() => guard.assertSafe(data), /quarantined/);
  const reopened = new HierarchyQuarantine();
  reopened.capture(data);
  assert.throws(() => reopened.assertSafe(data), /quarantined/);
  assert.equal(data.cloud.autoSync, false);
});
