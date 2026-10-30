import assert from "node:assert/strict";
import test from "node:test";
import {
  guardTicketChanges,
  operationTicketIds,
  reviewedTicketIds,
} from "../../src/domain/ticket-locks";
import type { TaskItem, TaskOperation } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const item = (id: string, parentId: string | null = null): TaskItem => {
  return {
    id,
    parentId,
    summary: "Synthetic",
    description: "",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
};
const edit = (id: string): TaskOperation => {
  return {
    type: "edit",
    opId: id + "-edit",
    issueId: id,
    base: item(id, "root"),
    patch: { priority: "High" },
  };
};
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [
    item("root"),
    item("a", "root"),
    item("b", "root"),
    item("child", "a"),
  ];
  data.operations = [edit("a")];
  return data;
};
void test("scalar locks allow sibling edits, drafts and navigation without locking shared parent", () => {
  const before = fixture(),
    after = structuredClone(before);
  const locked = operationTicketIds(before.operations[0]);
  assert.deepEqual([...locked], ["a"]);
  after.view.selected = "b";
  after.titleDrafts.b = "Unsent";
  after.commentDrafts.b = "Unposted";
  after.operations.push(edit("b"));
  assert.doesNotThrow(() => {
    return guardTicketChanges(before, after, locked);
  });
});
void test("locked operations, baselines and drafts cannot change or disappear", () => {
  const before = fixture();
  const mutations = [
    (data: typeof before) => {
      data.operations = [];
    },
    (data: typeof before) => {
      (
        data.operations[0] as Extract<TaskOperation, { type: "edit" }>
      ).patch.priority = "Low";
    },
    (data: typeof before) => {
      data.remote[1].description = "Changed";
    },
    (data: typeof before) => {
      data.titleDrafts.a = "Changed";
    },
    (data: typeof before) => {
      data.commentDrafts.a = "Changed";
    },
  ];
  for (const mutate of mutations) {
    const after = structuredClone(before);
    mutate(after);
    assert.throws(() => {
      return guardTicketChanges(before, after, new Set(["a"]));
    });
  }
});
void test("hierarchy changes cannot move into, create under, or delete an ancestor of locked tickets", () => {
  const before = fixture();
  const move = edit("b") as Extract<TaskOperation, { type: "edit" }>;
  move.patch = { parentId: "a" };
  const operations: TaskOperation[] = [
    move,
    {
      type: "create",
      opId: "new",
      issueId: "local-new",
      item: item("local-new", "a"),
    },
    { type: "delete", opId: "del", issueId: "root", ids: ["root"] },
  ];
  for (const operation of operations) {
    const after = structuredClone(before);
    after.operations.push(operation);
    assert.throws(() => {
      return guardTicketChanges(before, after, new Set(["a"]));
    });
  }
});
void test("global metadata stays protected even for otherwise unrelated changes", () => {
  const before = fixture(),
    after = structuredClone(before);
  after.cloud = { autoSync: true, records: {} };
  assert.throws(() => {
    return guardTicketChanges(before, after, new Set(["a"]));
  });
});
void test("review locks include ready records and malformed unassociated journals fail closed", () => {
  const before = fixture();
  before.cloud = {
    autoSync: false,
    records: { "a-edit": { status: "ready", message: "Synthetic" } },
  };
  assert.deepEqual([...reviewedTicketIds(before)], ["a"]);
  before.cloud.records.missing = { status: "conflict", message: "Synthetic" };
  const locked = reviewedTicketIds(before);
  assert.equal(locked.has("*"), true);
  const after = structuredClone(before);
  after.view.selected = "b";
  assert.doesNotThrow(() => {
    return guardTicketChanges(before, after, locked);
  });
  after.titleDrafts.b = "Changed";
  assert.throws(() => {
    return guardTicketChanges(before, after, locked);
  });
});

void test("baseline hierarchy changes into locked tickets are rejected", () => {
  const before = fixture(),
    after = structuredClone(before);
  after.remote[2].parentId = "a";
  assert.throws(() => {
    guardTicketChanges(before, after, new Set(["a"]));
  });
});
