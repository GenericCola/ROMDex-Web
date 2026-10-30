import assert from "node:assert/strict";
import test from "node:test";
import type { DeliveryRecord } from "../../src/cloud/types";
import { conflictSummary } from "../../src/components/romdex/conflict-summary";
import type { TaskItem, TaskOperation } from "../../src/domain/types";
const task = (): TaskItem => ({
  id: "PMON-499",
  summary: "Synthetic review task",
  description: "",
  state: "To Do",
  parentId: null,
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const deletion = (base = task()): TaskOperation => ({
  opId: "fixture",
  type: "delete",
  issueId: base.id,
  ids: [base.id],
  bases: { [base.id]: base },
});
const record = (remote = task()): DeliveryRecord => ({
  status: "conflict",
  message: "Changed fixture",
  remoteTasks: [remote],
});
test("deletion explains the exact target, state and comment-count change without comment text", () => {
  const remote = task();
  remote.state = "Done";
  remote.commentCount = 1;
  remote.comments = [
    {
      id: "fixture-comment",
      text: "SYNTHETIC HIDDEN COMMENT",
      author: "Fixture",
      created: 2,
    },
  ];
  const result = conflictSummary(deletion(), record(remote));
  assert.match(result.items.join("\n"), /PMON-499 · Synthetic review task/);
  assert.match(result.items.join("\n"), /State: To Do → Done/);
  assert.match(
    result.items.join("\n"),
    /1 comment added since review \(0 → 1\)/,
  );
  assert.doesNotMatch(
    result.items.join("\n"),
    /HIDDEN COMMENT|fixture-comment/,
  );
  assert.match(result.explanation, /saved review snapshots/);
});
test("deletion describes changed fields but withholds notes and unknown structured content", () => {
  const base = task(),
    remote = task();
  Object.assign(remote, {
    summary: "Renamed fixture",
    description: "HIDDEN NOTES",
    priority: "High",
    complexity: "Hard",
    parentId: "PMON-498",
    "custom:fixture": { private: "HIDDEN STRUCTURE" },
  });
  const result = conflictSummary(deletion(base), record(remote)).items.join(
    "\n",
  );
  for (const expected of [
    "Title:",
    "Notes changed",
    "Priority:",
    "Complexity:",
    "Parent:",
    "Other task fields changed",
  ])
    assert.ok(result.includes(expected));
  assert.doesNotMatch(result, /HIDDEN/);
});
test("missing deletion evidence never claims that deletion succeeded", () => {
  const op = deletion();
  assert.match(
    conflictSummary(op, { status: "uncertain", message: "" }).items.join("\n"),
    /snapshot unavailable.*does not prove deletion/,
  );
  if (op.type === "delete") delete op.bases;
  assert.match(
    conflictSummary(op, record()).items.join("\n"),
    /baseline unavailable/,
  );
  assert.match(
    conflictSummary(undefined, record()).items.join("\n"),
    /queued change is unavailable/,
  );
});
test("revision-only changes and confirmed earlier deletions remain explicit", () => {
  const remote = task();
  remote.updated = 2;
  assert.match(
    conflictSummary(deletion(), record(remote)).items.join("\n"),
    /revision changed/,
  );
  assert.match(
    conflictSummary(deletion(), {
      ...record(),
      deletedIds: ["PMON-499"],
    }).items.join("\n"),
    /previously confirmed. Do not resend/,
  );
});
test("generic edit comparisons show primitive values and redact notes or unknown object fields", () => {
  const op: TaskOperation = {
    opId: "fixture",
    type: "edit",
    issueId: "PMON-499",
    base: task(),
    patch: { state: "Done" },
  };
  const result = conflictSummary(op, {
    ...record(),
    conflicts: [
      { field: "state", base: "To Do", local: "Done", remote: "In Progress" },
      {
        field: "description",
        base: "HIDDEN BASE",
        local: "HIDDEN LOCAL",
        remote: "HIDDEN REMOTE",
      },
      {
        field: "custom:fixture",
        base: null,
        local: { hidden: "SECRET" },
        remote: { hidden: "SECRET" },
      },
    ],
  }).items.join("\n");
  assert.match(
    result,
    /State: reviewed To Do; browser Done; YouTrack In Progress/,
  );
  assert.match(result, /Other task field/);
  assert.doesNotMatch(result, /HIDDEN|SECRET|\{/);
});

test("unknown prototype-named fields never reveal their values", () => {
  const op: TaskOperation = {
    opId: "fixture",
    type: "comment",
    issueId: "PMON-499",
    text: "PRIVATE COMMENT",
    created: 1,
  };
  const result = conflictSummary(op, {
    ...record(),
    conflicts: [
      {
        field: "constructor",
        base: "PRIVATE BASE",
        local: "PRIVATE LOCAL",
        remote: "PRIVATE REMOTE",
      },
    ],
  });
  assert.match(result.items.join("\n"), /Other task field/);
  assert.doesNotMatch(result.items.join("\n"), /PRIVATE/);
});
