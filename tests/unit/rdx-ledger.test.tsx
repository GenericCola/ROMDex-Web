import assert from "node:assert/strict";
import test from "node:test";
import { completeCreation } from "../../src/cloud/creation";
import { acknowledge } from "../../src/cloud/journal";
import { createTask } from "../../src/domain/task-actions";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
void test("plan receipts remap creations and wait for the separately confirmed parent link", () => {
  const data = emptyWorkspace();
  const local = createTask(data, null, "Synthetic plan item");
  const op = data.operations[0];
  assert.ok(op?.type === "create");
  op.item.parentId = "PMON-1";
  data.rdxImports = {
    fixture: {
      tasks: { portable: { issueId: local, desired: { parentId: "PMON-1" } } },
      batches: {
        batch: {
          id: "batch",
          revision: "0".repeat(64),
          taskIds: ["portable"],
          opIds: [op.opId],
          completed: [],
          status: "pending",
        },
      },
    },
  };
  completeCreation(data, op, {
    ...op.item,
    id: "PMON-2",
    parentId: null,
    updated: 1,
  });
  const ledger = data.rdxImports.fixture;
  assert.ok(ledger);
  assert.equal(ledger.tasks.portable?.issueId, "PMON-2");
  assert.equal(ledger.batches.batch?.status, "pending");
  assert.deepEqual(ledger.batches.batch?.opIds, [op.opId, op.opId + ":parent"]);
  const link = data.operations[0];
  assert.ok(link?.type === "edit");
  acknowledge(data, link, {
    ...op.item,
    id: "PMON-2",
    parentId: "PMON-1",
    updated: 2,
  });
  assert.equal(ledger.batches.batch?.status, "complete");
  assert.equal(ledger.tasks.portable?.nativeUpdated, 2);
});
void test("malformed plan ledger cannot silently lose sent-operation receipts", () => {
  const data = emptyWorkspace();
  Object.assign(data, {
    rdxImports: {
      fixture: {
        tasks: {},
        batches: {
          batch: {
            id: "batch",
            revision: "0".repeat(64),
            taskIds: [],
            opIds: ["sent"],
            completed: [],
            status: "complete",
          },
        },
      },
    },
  });
  assert.throws(() => {
    return validateWorkspace(data);
  }, /Invalid task plan receipt/);
});
void test("malformed optional plan delivery metadata fails closed", () => {
  const data = emptyWorkspace();
  const batch = {
    id: "batch",
    revision: "0".repeat(64),
    taskIds: [],
    opIds: ["one"],
    completed: [],
    status: "pending",
  };
  for (const invalid of [
    { destination: {} },
    { entries: [] },
    { entries: [{ opId: "other", type: "create", issueId: "local-one" }] },
    { entries: [{ opId: "one", type: "create", issueId: "" }] },
  ]) {
    Object.assign(data, {
      rdxImports: {
        fixture: { tasks: {}, batches: { batch: { ...batch, ...invalid } } },
      },
    });
    assert.throws(
      () => validateWorkspace(data),
      /Invalid task plan delivery metadata/,
    );
  }
  Object.assign(data, {
    rdxImports: { fixture: { tasks: {}, batches: {}, review: [] } },
  });
  assert.throws(() => validateWorkspace(data), /Invalid task plan ledger/);
});
