import assert from "node:assert/strict";
import test from "node:test";
import { nativeTaskFields } from "../../src/youtrack/native-task-fields";
void test("native fields retain original desktop date, assignee, tags and custom-value shapes", () => {
  const fields = [
    { id: "1-1", name: "Assignee", value: { id: "2-1", fullName: "Fixture" } },
    {
      id: "1-2",
      name: "Due Date",
      value: Date.UTC(2026, 9, 30, 12),
      $type: "DateIssueCustomField",
    },
    {
      id: "1-3",
      name: "Estimate",
      value: { minutes: 90 },
      $type: "PeriodIssueCustomField",
    },
    {
      id: "1-4",
      name: "Extra Notes",
      value: { text: "Literal <data>" },
      $type: "TextIssueCustomField",
    },
    { id: "1-5", name: "State", value: { id: "3-1", name: "Done" } },
  ];
  const before = JSON.stringify(fields);
  const result = nativeTaskFields(fields, [{ id: "4-1", name: "Tag" }]);
  assert.equal(result.dueDate, "2026-10-30");
  assert.equal(result.assignee, "2-1");
  assert.deepEqual(result.assignees, [{ id: "2-1", name: "Fixture" }]);
  assert.deepEqual(result.tags, ["4-1"]);
  assert.equal(result["custom:1-3"], 90);
  assert.equal(result["custom:1-4"], "Literal <data>");
  assert.equal(result["custom:1-5"], undefined);
  assert.equal(result._custom.length, 5);
  assert.equal(JSON.stringify(fields), before);
});
void test("malformed native values cannot be converted into silent clears", () => {
  assert.throws(
    () => nativeTaskFields([{ name: "Assignee", value: "not a user" }]),
    /Invalid native assignee/,
  );
  assert.throws(
    () => nativeTaskFields([{ name: "Due Date", value: "not a date" }]),
    /Invalid native due date/,
  );
  assert.throws(
    () => nativeTaskFields([], [{ id: "", name: "Tag" }]),
    /Invalid native tags/,
  );
});
void test("recovery cannot pass malformed native metadata into the restored editor", async () => {
  const { emptyWorkspace, validateWorkspace } =
    await import("../../src/domain/workspace-data");
  const { createTask } = await import("../../src/domain/task-actions");
  const { materialize } = await import("../../src/domain/accepted/core.mjs");
  const data = emptyWorkspace();
  createTask(data, null, "Fixture");
  data.remote = materialize(data.remote, data.operations);
  data.operations = [];
  const item = data.remote[0];
  assert.ok(item);
  for (const metadata of [
    { dueDate: "2026-02-31" },
    { tags: ["same", "same"] },
    { _custom: {} },
    { assignee: [null] },
  ]) {
    const invalid = structuredClone(data);
    Object.assign(invalid.remote[0] ?? {}, metadata);
    assert.throws(() => validateWorkspace(invalid), /Invalid native/);
  }
});
