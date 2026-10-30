import assert from "node:assert/strict";
import test from "node:test";
import { pullPlan } from "../../src/domain/accepted/rdx/plan-pull.mjs";
import { jsonObject } from "../../src/domain/json";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { documentRevision, readRdx, writeRdx } from "../../src/rdx/container";
import type { PlanLedger } from "../../src/rdx/plan-ledger";
import { planDocument } from "../fixtures/rdx";
const fixture = async () => {
  const doc = planDocument(),
    value = await readRdx(await writeRdx(doc, new Map())),
    state = emptyWorkspace();
  const portable = jsonObject((jsonObject(doc.content).tasks as never[])[0]);
  createTask(state, null, "Native title");
  const op = state.operations[0];
  assert.ok(op?.type === "create");
  state.remote = [{ ...op.item, id: "PMON-1", updated: 10 }];
  state.operations = [];
  const ledger: PlanLedger = {
    tasks: {
      "task:fixture": {
        issueId: "PMON-1",
        desired: { parentId: null },
        portable,
      },
    },
    batches: {
      b: {
        id: "b",
        revision: String(doc.revision),
        taskIds: ["task:fixture"],
        opIds: [],
        completed: [],
        status: "complete",
      },
    },
  };
  return { doc, value, state, ledger };
};
void test("desktop native pull updates a separate plan copy and requires exact conflict choices", async () => {
  const { value, state, ledger } = await fixture();
  const original = structuredClone(value.document);
  const next = pullPlan(value, ledger, state, {});
  assert.equal(
    jsonObject((jsonObject(next.document.content).tasks as never[])[0]).title,
    "Native title",
  );
  assert.deepEqual(value.document, original);
  const task = jsonObject(
    (jsonObject(value.document.content).tasks as never[])[0],
  );
  task.title = "Local title";
  value.document.revision = documentRevision(value.document);
  const review = pullPlan(value, ledger, state, {});
  assert.equal(review.conflicts.length, 1);
  assert.equal(review.conflicts[0]?.id, "task:fixture:title");
  const accepted = pullPlan(
    value,
    ledger,
    state,
    {},
    { choices: { "task:fixture:title": "incoming" } },
  );
  assert.equal(accepted.token, review.token);
  assert.equal(
    jsonObject((jsonObject(accepted.document.content).tasks as never[])[0])
      .title,
    "Native title",
  );
  await writeRdx(accepted.document, accepted.blobs);
});
void test("pending saves and unrepresentable Awaiting Testing keep the existing portable plan", async () => {
  const { value, state, ledger } = await fixture();
  const original = structuredClone(value.document);
  const item = state.remote[0];
  assert.ok(item);
  item.assignedState = "Awaiting Testing";
  assert.throws(() => {
    return pullPlan(value, ledger, state, {});
  }, /no portable mapping/i);
  assert.deepEqual(value.document, original);
  delete item.assignedState;
  state.operations.push({
    opId: "pending",
    type: "comment",
    issueId: "PMON-1",
    text: "Unsent",
    created: 1,
  });
  assert.throws(() => {
    return pullPlan(value, ledger, state, {});
  }, /Finish Pending Task Saves/);
});
