import assert from "node:assert/strict";
import test from "node:test";
import { preservesLockedOrder } from "../../src/domain/locked-ticket-order";
import { applyTaskDrop, hierarchySignature } from "../../src/domain/task-drop";
import { guardTicketChanges } from "../../src/domain/ticket-locks";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const item = (id: string): TaskItem => ({
  id,
  parentId: null,
  summary: id,
  description: "",
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [item("A"), item("B"), item("C")];
  data.operations = [
    {
      type: "edit",
      opId: "edit-A",
      issueId: "A",
      base: item("A"),
      patch: { summary: "keep" },
    },
  ];
  data.cloud = {
    autoSync: true,
    records: { "edit-A": { status: "uncertain", message: "keep" } },
  };
  return data;
};
test("sparse order normalizes around locked A while B and C reorder, all other data retained", () => {
  const data = fixture(),
    before = structuredClone(data);
  applyTaskDrop(
    data,
    { dragId: "B", targetId: "C", delta: 0, after: true },
    hierarchySignature(data),
  );
  assert.deepEqual(data.order, { A: 0, C: 1, B: 2 });
  assert.deepEqual({ ...data, order: {} }, before);
  assert.doesNotThrow(() => guardTicketChanges(before, data, new Set(["A"])));
});
test("crossing locked A or reparenting under A still fails without mutation", () => {
  for (const intent of [
    { dragId: "B", targetId: "A", delta: 0, after: false },
    { dragId: "B", targetId: "A", delta: 1, after: true },
  ]) {
    const data = fixture(),
      before = structuredClone(data);
    assert.throws(
      () => applyTaskDrop(data, intent, hierarchySignature(data)),
      /review/i,
    );
    assert.deepEqual(data, before);
  }
});
test("unchanged locked rank or index cannot hide crossings; rollup descendant locks remain protected", () => {
  const before = fixture();
  before.order = { B: 0, A: 1, C: 2 };
  const after = structuredClone(before);
  after.order = { C: 0, A: 1, B: 2 };
  assert.equal(preservesLockedOrder(before, after, new Set(["A"])), false);
  assert.throws(() => guardTicketChanges(before, after, new Set(["A"])));
  const base = fixture(),
    reordered = structuredClone(base);
  reordered.order = { A: 0, C: 1, B: 2 };
  assert.throws(() =>
    guardTicketChanges(base, reordered, new Set(["A", "B", "C"])),
  );
});
test("invalid ranks and any mutation of locked remote, draft, operation or journal still fail", () => {
  for (const rank of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const before = fixture(),
      after = structuredClone(before);
    after.order.A = rank;
    assert.throws(() => guardTicketChanges(before, after, new Set(["A"])));
  }
  const changes = [
    (data: ReturnType<typeof fixture>) => {
      assert.ok(data.remote[0]);
      data.remote[0].summary = "unsafe";
    },
    (data: ReturnType<typeof fixture>) => {
      data.titleDrafts.A = "unsafe";
    },
    (data: ReturnType<typeof fixture>) => {
      data.operations = [];
    },
    (data: ReturnType<typeof fixture>) => {
      data.cloud!.records = {};
    },
  ];
  for (const change of changes) {
    const before = fixture(),
      after = structuredClone(before);
    after.order = { A: 0, C: 1, B: 2 };
    change(after);
    assert.throws(() => guardTicketChanges(before, after, new Set(["A"])));
  }
});
