import assert from "node:assert/strict";
import test from "node:test";
import { rowLockKey } from "../../src/components/romdex/row-lock-key";
import WorkRow from "../../src/components/romdex/work-row";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";

void test("WorkRow is a memoized component", () => {
  assert.equal(
    (WorkRow as unknown as { $$typeof: symbol }).$$typeof,
    Symbol.for("react.memo"),
  );
});

void test("row lock key changes with reviewed tickets and delivery tickets", () => {
  const data = emptyWorkspace();
  createTask(data, null, "Fixture");
  const base = rowLockKey(data);
  assert.equal(rowLockKey(data), base);
  const reviewed = emptyWorkspace();
  reviewed.cloud = {
    autoSync: false,
    records: { op1: { status: "ready" } },
  } as unknown as NonNullable<typeof reviewed.cloud>;
  assert.notEqual(rowLockKey(reviewed), base);
  const store = workspaceStore as unknown as { activeTickets: Set<string> };
  store.activeTickets.add("T-1");
  try {
    assert.notEqual(rowLockKey(data), base);
  } finally {
    store.activeTickets.delete("T-1");
  }
  assert.equal(rowLockKey(data), base);
});
