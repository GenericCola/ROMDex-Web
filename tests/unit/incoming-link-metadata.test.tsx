import assert from "node:assert/strict";
import test from "node:test";
import { mergeIncoming } from "../../src/cloud/incoming-merge";
import { editTask } from "../../src/domain/task-actions";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const task = (): TaskItem => ({
  id: "PMON-1",
  updated: 10,
  parentId: null,
  summary: "Keep title",
  description: "Keep notes",
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  comments: [],
  commentCount: 0,
});
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [task()];
  data.cloud = { records: {}, autoSync: true, accountId: "fixture-owner" };
  return data;
};
test("equal revision hydrates only unknown link count without edits or status work", () => {
  const data = fixture(),
    before = structuredClone(data);
  assert.equal(
    mergeIncoming(
      data,
      [
        {
          ...task(),
          dependencies: 4,
          summary: "Untrusted equal title",
          state: "Done",
        },
      ],
      new Set(),
    ),
    true,
  );
  assert.ok(before.remote[0]);
  before.remote[0].dependencies = 4;
  assert.deepEqual(data, before);
  assert.equal(
    mergeIncoming(data, [{ ...task(), dependencies: 9 }], new Set()),
    false,
  );
  assert.ok(data.remote[0]);
  assert.equal(data.remote[0].dependencies, 4);
});
test("zero is known metadata; missing and older values cannot change cache", () => {
  const data = fixture();
  assert.equal(
    mergeIncoming(
      data,
      [{ ...task(), updated: 9, dependencies: 2 }],
      new Set(),
    ),
    false,
  );
  assert.equal(mergeIncoming(data, [{ ...task() }], new Set()), false);
  mergeIncoming(data, [{ ...task(), dependencies: 0 }], new Set());
  assert.ok(data.remote[0]);
  assert.equal(data.remote[0].dependencies, 0);
});
test("focused, queued and newer observed baselines prevent metadata hydration", () => {
  for (const mode of ["focused", "queued", "observed"]) {
    const data = fixture();
    if (mode === "queued")
      editTask(data, "PMON-1", { summary: "Local change" });
    if (mode === "observed")
      data.cloud!.assigned = {
        "PMON-1": {
          assignedState: "To do",
          lastState: "To do",
          lastUpdated: 11,
          pendingState: null,
        },
      };
    const before = structuredClone(data);
    mergeIncoming(
      data,
      [{ ...task(), dependencies: 3 }],
      new Set(mode === "focused" ? ["PMON-1"] : []),
    );
    assert.deepEqual(data, before);
  }
});
