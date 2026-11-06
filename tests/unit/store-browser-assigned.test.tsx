import assert from "node:assert/strict";
import { test } from "node:test";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import {
  ASSIGNED_IN_STORE,
  applyAssigned,
  applyAssignedWith,
  assignedActive,
  localAssigned,
  localAssignedWith,
} from "../../src/store/browser/assigned";

const item = (id: string, parentId: string | null = null): TaskItem => {
  return {
    id,
    parentId,
    summary: id,
    description: "",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 5,
    comments: [],
    commentCount: 0,
  };
};

const workspace = (): WorkspaceData => {
  const data = emptyWorkspace();
  data.remote = [
    item("PMON-1"),
    { ...item("PMON-2", "PMON-1"), assignedState: "Done" },
    item("PMON-3"),
  ];
  return data;
};

test("switch is on and sharedStatuses turns it off", () => {
  const data = workspace();
  assert.equal(ASSIGNED_IN_STORE, true);
  assert.equal(assignedActive(data), true);
  data.cloud = { autoSync: false, records: {}, sharedStatuses: true };
  assert.equal(assignedActive(data), false);
});

test("off path passes remote assigned keys through", () => {
  const data = workspace();
  const remote = { "assigned/PMON-9": "Done", "orders/ROOT": ["a"] };
  assert.deepEqual(
    localAssignedWith(false, data, { "assigned/x": "y" }, remote),
    {
      "assigned/PMON-9": "Done",
    },
  );
  const before = structuredClone(data);
  assert.deepEqual(
    applyAssignedWith(false, data, { "assigned/PMON-1": "Done" }, [
      "assigned/PMON-1",
    ]),
    [],
  );
  assert.deepEqual(data, before);
});

test("active capture covers parents and known ids and carries the rest", () => {
  const data = workspace();
  const base = { "assigned/PMON-3": "Old", "assigned/PMON-99": "Done" };
  assert.deepEqual(localAssigned(data, base, {}), {
    "assigned/PMON-1": "To do",
    "assigned/PMON-3": "To do",
    "assigned/PMON-99": "Done",
  });
  const fresh = localAssigned(data, null, { "assigned/PMON-99": "Done" });
  assert.equal(fresh["assigned/PMON-99"], "Done");
  assert.equal("assigned/PMON-2" in fresh, false);
});

test("apply updates the item, the cloud record and pending edits", () => {
  const data = workspace();
  data.cloud = {
    autoSync: false,
    records: {},
    assigned: {
      "PMON-3": {
        assignedState: "To do",
        lastState: "To do",
        lastUpdated: 5,
        pendingState: null,
      },
    },
  };
  data.operations = [
    {
      opId: "a",
      type: "edit",
      issueId: "PMON-3",
      base: item("PMON-3"),
      patch: { assignedState: "Old" },
    },
    {
      opId: "b",
      type: "edit",
      issueId: "PMON-1",
      base: item("PMON-1"),
      patch: { assignedState: "Old", summary: "S" },
    },
  ];
  const held = applyAssigned(
    data,
    {
      "assigned/PMON-1": "Done",
      "assigned/PMON-3": "Done",
      "assigned/PMON-77": "Done",
    },
    [
      "assigned/PMON-1",
      "assigned/PMON-3",
      "assigned/PMON-77",
      "assigned/PMON-2",
    ],
  );
  assert.deepEqual(held, ["assigned/PMON-77"]);
  assert.equal(data.remote[0]?.assignedState, "Done");
  assert.equal(data.cloud.assigned?.["PMON-3"]?.assignedState, "Done");
  assert.equal(data.cloud.assigned?.["PMON-1"]?.lastState, "To do");
  assert.equal(data.operations.length, 1);
  const op = data.operations[0];
  assert.ok(op?.type === "edit");
  assert.deepEqual(op.patch, { summary: "S" });
  assert.equal(op.opId, "b");
});
