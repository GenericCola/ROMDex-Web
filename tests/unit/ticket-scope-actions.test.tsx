import assert from "node:assert/strict";
import test from "node:test";
import { cancelUnsentUpload, queueUpload } from "../../src/attachments/actions";
import { stageMove } from "../../src/domain/bulk-hierarchy";
import { deleteTask, editTask } from "../../src/domain/task-actions";
import { applyTaskDrop, hierarchySignature } from "../../src/domain/task-drop";
import {
  guardTicketChanges,
  reviewedTicketIds,
} from "../../src/domain/ticket-locks";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const item = (id: string, parentId: string | null = null): TaskItem => ({
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
});
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [
    item("PMON-1"),
    item("PMON-2"),
    item("PMON-3", "PMON-2"),
    item("PMON-4", "PMON-2"),
    item("PMON-5"),
  ];
  editTask(data, "PMON-1", { priority: "High" });
  data.cloud = {
    autoSync: false,
    accountId: "fixture",
    records: {
      [data.operations[0]!.opId]: {
        status: "conflict",
        message: "Synthetic conflict",
      },
    },
  };
  return data;
};
const file = {
  name: "synthetic.txt",
  size: 1,
  mimeType: "text/plain",
  hash: "a".repeat(64),
};
void test("unrelated attachment queue/cancel is allowed; reviewed ticket and existing evidence stay blocked", () => {
  const before = fixture(),
    next = structuredClone(before);
  queueUpload(next, "PMON-3", "upload", file);
  guardTicketChanges(before, next, reviewedTicketIds(before));
  assert.throws(() => {
    queueUpload(next, "PMON-1", "locked", file);
  });
  const queued = structuredClone(next);
  cancelUnsentUpload(next, "upload");
  assert.doesNotThrow(() => {
    guardTicketChanges(queued, next, reviewedTicketIds(queued));
  });
  queued.cloud!.records.upload = {
    status: "uncertain",
    message: "Existing evidence",
  };
  assert.throws(() => {
    cancelUnsentUpload(queued, "upload");
  });
});
void test("unrelated deletion archives exact removed operation without weakening journal protection", () => {
  const before = fixture();
  editTask(before, "PMON-3", { description: "Unsent" });
  const next = structuredClone(before);
  deleteTask(next, "PMON-3");
  assert.doesNotThrow(() => {
    guardTicketChanges(before, next, reviewedTicketIds(before));
  });
  const archiveId = before.operations[1]!.opId;
  for (const field of ["remoteId", "deletedIds", "conflicts"]) {
    const corrupt = structuredClone(next);
    Object.assign(corrupt.cloud!.records[archiveId]!, {
      [field]: field === "remoteId" ? "invented" : [],
    });
    assert.throws(() => {
      guardTicketChanges(before, corrupt, reviewedTicketIds(before));
    });
  }
  const replaced = structuredClone(next);
  replaced.cloud!.records[before.operations[0]!.opId]!.message = "Replaced";
  assert.throws(() => {
    guardTicketChanges(before, replaced, reviewedTicketIds(before));
  });
  const ledger = structuredClone(next);
  ledger.rdxImports = {};
  assert.throws(() => {
    guardTicketChanges(before, ledger, reviewedTicketIds(before));
  });
});
void test("unrelated bulk move and drop remain usable; failed locked moves leave input unchanged", () => {
  const bulk = fixture();
  stageMove(
    bulk,
    ["PMON-3", "PMON-4"],
    "PMON-5",
    null,
    hierarchySignature(bulk),
  );
  assert.equal(bulk.operations.at(-1)?.issueId, "PMON-4");
  const drop = fixture();
  applyTaskDrop(
    drop,
    { dragId: "PMON-3", targetId: "PMON-4", after: true, delta: 0 },
    hierarchySignature(drop),
  );
  assert.ok(drop.order["PMON-3"] !== undefined);
  for (const mode of ["bulk", "drop"]) {
    const data = fixture(),
      original = structuredClone(data);
    assert.throws(() => {
      if (mode === "bulk")
        stageMove(
          data,
          ["PMON-1", "PMON-5"],
          "PMON-2",
          null,
          hierarchySignature(data),
        );
      else
        applyTaskDrop(
          data,
          { dragId: "PMON-1", targetId: "PMON-5", after: true, delta: 1 },
          hierarchySignature(data),
        );
    });
    assert.deepEqual(data, original);
  }
});
