import assert from "node:assert/strict";
import test from "node:test";
import { desktopTask } from "../../src/migration/desktop-task";
const base = {
  id: "PMON-900001",
  summary: "Fixture",
  state: "To do",
  priority: "Normal",
  type: "Task",
  parentId: null,
  updated: 1,
};
void test("desktop baseline keeps native fields and multiple stable assignee IDs without modifying source", () => {
  const raw = {
    ...base,
    assignee: ["1-1", "1-2"],
    dueDate: "2026-10-30",
    tags: ["4-1"],
    tagNames: [{ id: "4-1", name: "Original tag" }],
    _custom: [
      {
        id: "5-1",
        name: "Estimate",
        $type: "PeriodIssueCustomField",
        value: { minutes: 90 },
      },
    ],
    "custom:5-1": 90,
  };
  const before = JSON.stringify(raw),
    item = desktopTask(raw);
  assert.deepEqual(item.assignee, raw.assignee);
  assert.deepEqual(item.assignees, [
    { id: "1-1", name: "1-1" },
    { id: "1-2", name: "1-2" },
  ]);
  for (const key of [
    "dueDate",
    "tags",
    "tagNames",
    "_custom",
    "custom:5-1",
  ] as const)
    assert.deepEqual(item[key], raw[key]);
  assert.equal(JSON.stringify(raw), before);
  assert.notEqual(item._custom, raw._custom);
});
void test("explicit native clears and supplied assignee display labels survive desktop import", () => {
  const item = desktopTask({
    ...base,
    assignee: null,
    dueDate: null,
    tags: [],
  });
  assert.equal(item.assignee, null);
  assert.equal(item.dueDate, null);
  assert.deepEqual(item.tags, []);
  assert.deepEqual(
    desktopTask({ ...base, assignee: "1-1", assigneeName: "Original name" })
      .assignees,
    [{ id: "1-1", name: "Original name" }],
  );
  assert.deepEqual(
    desktopTask({
      ...base,
      assignee: ["1-1"],
      assignees: [{ id: "1-1", name: "Known name" }],
    }).assignees,
    [{ id: "1-1", name: "Known name" }],
  );
});
void test("malformed imported native metadata blocks rather than silently discarding fields", () => {
  for (const metadata of [
    { assignee: [null] },
    { dueDate: "2026-02-31" },
    { tags: ["same", "same"] },
    { _custom: {} },
    { tagNames: [{ id: "x", name: null }] },
  ])
    assert.throws(() => desktopTask({ ...base, ...metadata }), /Invalid/);
});

void test("multiple desktop assignee names are matched by native identity, not array position", () => {
  const item = desktopTask({
    ...base,
    assignee: ["1-1", "1-2"],
    _custom: [
      {
        name: "Assignee",
        value: [
          { id: "1-2", fullName: "Second" },
          { id: "1-1", fullName: "First" },
        ],
      },
    ],
  });
  assert.deepEqual(item.assignees, [
    { id: "1-1", name: "First" },
    { id: "1-2", name: "Second" },
  ]);
});
