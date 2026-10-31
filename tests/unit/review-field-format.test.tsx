import assert from "node:assert/strict";
import test from "node:test";
import type { DeliveryRecord } from "../../src/cloud/types";
import { conflictSummary } from "../../src/components/romdex/conflict-summary";
import {
  reviewFieldLabel,
  reviewFieldValue,
} from "../../src/components/romdex/review-field-format";
import {
  proposedOperationSummary,
  reviewChoiceLabel,
} from "../../src/components/romdex/review-operation-summary";
import type { TaskItem, TaskOperation } from "../../src/domain/types";
const base: TaskItem = {
  id: "PMON-900099",
  summary: "Synthetic status fixture",
  description: "PRIVATE NOTES",
  parentId: null,
  state: "Critical / Debugging",
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
  _custom: [
    {
      id: "field-one",
      name: "Release",
      $type: "SingleEnumIssueCustomField",
      value: { id: "enum-one", name: "Summer" },
    },
    {
      id: "field-text",
      name: "Instructions",
      $type: "TextIssueCustomField",
      value: { text: "PRIVATE" },
    },
  ],
  assignees: [{ id: "user-one", name: "Fixture Person" }],
  tagNames: [{ id: "tag-one", name: "Fixture tag" }],
};
const op: TaskOperation = {
  type: "edit",
  opId: "fixture",
  issueId: base.id,
  base,
  patch: { assignedState: "Done" },
};
test("ordinary assigned status conflict explains proposed and competing values and exact choices", () => {
  const record: DeliveryRecord = {
    status: "conflict",
    message: "Changed",
    conflicts: [
      {
        field: "assignedState",
        base: "Critical / Debugging",
        local: "Done",
        remote: "Needs Testing",
      },
    ],
  };
  const text = conflictSummary(op, record).items.join("\n");
  assert.match(text, /change status to Done/);
  assert.match(
    text,
    /reviewed Critical \/ Debugging; browser Done; YouTrack Needs Testing/,
  );
  assert.match(reviewChoiceLabel(op, record, true)!, /Use my choice: Done/);
  assert.match(
    reviewChoiceLabel(op, record, false)!,
    /Keep YouTrack: Needs Testing/,
  );
});
test("native enum, user and tag identifiers resolve only from exact unambiguous saved evidence", () => {
  assert.equal(reviewFieldLabel("custom:field-one", [base]), "Release");
  assert.equal(
    reviewFieldValue("custom:field-one", "enum-one", [base]),
    "Summer",
  );
  assert.equal(
    reviewFieldValue("custom:field-one", ["enum-one", "enum-missing"], [base]),
    "Summer, Unknown identifier enum-missing",
  );
  assert.equal(
    reviewFieldValue("assignee", ["user-one"], [base]),
    "Fixture Person",
  );
  assert.equal(reviewFieldValue("tags", ["tag-one"], [base]), "Fixture tag");
  const renamed = structuredClone(base);
  renamed.assignees = [{ id: "user-one", name: "Different name" }];
  assert.equal(
    reviewFieldValue("assignee", "user-one", [base, renamed]),
    "Unknown identifier user-one",
  );
  assert.equal(
    reviewFieldValue("custom:missing", "opaque-id", [base]),
    "Unknown identifier opaque-id",
  );
  assert.equal(
    reviewFieldValue("custom:field-text", "PRIVATE", [base]),
    "content withheld",
  );
  assert.equal(
    reviewFieldValue("description", "PRIVATE", [base]),
    "content withheld",
  );
  assert.equal(
    reviewFieldValue("priority", undefined, [base]),
    "not available",
  );
  assert.equal(reviewFieldValue("priority", null, [base]), "none");
});
test("proposed edit remains readable without conflict evidence; missing fields never guess names", () => {
  const edit = {
    ...op,
    patch: { "custom:field-one": "enum-missing", description: "PRIVATE" },
  } as TaskOperation;
  const result = conflictSummary(edit, {
    status: "uncertain",
    message: "interrupted",
  }).items.join("\n");
  assert.match(result, /change release to Unknown identifier enum-missing/);
  assert.match(result, /change notes to content withheld/);
  assert.match(result, /No field comparison is available/);
  assert.doesNotMatch(result, /PRIVATE/);
  const deletionSummary = proposedOperationSummary({
    type: "delete",
    opId: "d",
    issueId: base.id,
    ids: [base.id],
  })[0];
  assert.ok(deletionSummary);
  assert.match(deletionSummary, /delete listed tasks: PMON-900099/);
});

test("supplied native labels are readable but conflicting saved names remain uncertain; dates are explicit", () => {
  assert.equal(
    reviewFieldValue("assignee", { id: "new-user", fullName: "New Person" }, [
      base,
    ]),
    "New Person",
  );
  assert.equal(
    reviewFieldValue(
      "assignee",
      { id: "user-one", name: "Conflicting Person" },
      [base],
    ),
    "Unknown identifier user-one",
  );
  assert.equal(
    reviewFieldValue("custom:field-one", { id: "new-enum", name: "Winter" }, [
      base,
    ]),
    "Winter",
  );
  assert.equal(
    reviewFieldValue("dueDate", Date.UTC(2026, 9, 31, 12), [base]),
    "2026-10-31",
  );
  assert.equal(reviewFieldValue("dueDate", Infinity, [base]), "not available");
  assert.equal(reviewFieldValue("dueDate", 9e20, [base]), "not available");
  const dateTask = {
    ...base,
    _custom: [
      {
        id: "date-field",
        name: "Target date",
        $type: "DateIssueCustomField",
        value: null,
      },
    ],
  };
  assert.equal(
    reviewFieldValue("custom:date-field", Date.UTC(2026, 9, 31, 12), [
      dateTask,
    ]),
    "2026-10-31",
  );
  assert.equal(
    reviewFieldValue("custom:field-text", { id: "text", name: "PRIVATE" }, [
      base,
    ]),
    "content withheld",
  );
});

test("single conflict within mixed edit never implies field-only discard or keep", () => {
  const mixed: TaskOperation = {
    ...op,
    type: "edit",
    base,
    patch: { assignedState: "Done", priority: "High" },
  };
  const record: DeliveryRecord = {
    status: "conflict",
    message: "Changed",
    conflicts: [
      {
        field: "assignedState",
        base: "Critical / Debugging",
        local: "Done",
        remote: "Needs Testing",
      },
    ],
  };
  assert.equal(reviewChoiceLabel(mixed, record, true), undefined);
  assert.equal(reviewChoiceLabel(mixed, record, false), undefined);
  assert.equal(proposedOperationSummary(mixed, record).length, 2);
});
