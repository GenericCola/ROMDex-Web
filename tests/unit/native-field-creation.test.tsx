import assert from "node:assert/strict";
import test from "node:test";
import { matchesCreation } from "../../src/cloud/creation";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { createTask, editTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { NativeEditAdapter } from "../../src/youtrack/native-edit-adapter";
import { sessionRequest } from "../../src/youtrack/request";
import {
  nativeFixtureFetch,
  rawIssue,
} from "../fixtures/native-field-delivery";
void test("creation preparation preserves native extras without sending a request", async (t) => {
  let writes = 0;
  t.mock.method(
    globalThis,
    "fetch",
    nativeFixtureFetch(rawIssue(), () => {
      writes++;
    }),
  );
  const data = emptyWorkspace(),
    id = createTask(data, null, "Fixture");
  editTask(data, id, {
    assignee: "1-1",
    dueDate: "2026-10-30",
    "custom:f-period": 90,
  });
  const item = materialize(data.remote, data.operations)[0];
  assert.ok(item);
  const adapter = new NativeEditAdapter(
    sessionRequest("fixture-only"),
    () => {
      return Promise.resolve(null);
    },
    () => {
      return [];
    },
  );
  const body = await adapter.creation(item, {
    customFields: [{ name: "Type", value: { name: "Epic" } }],
  });
  assert.ok(Array.isArray(body.customFields));
  assert.equal(body.customFields.length, 4);
  assert.equal(writes, 0);
  const remote = { ...item, id: "PMON-1" };
  assert.equal(matchesCreation(item, remote), true);
  assert.equal(
    matchesCreation(item, { ...remote, "custom:f-period": null }),
    false,
  );
});
void test("explicit custom Type creation is verified by its native field identity rather than an obsolete type label", () => {
  const data = emptyWorkspace(),
    id = createTask(data, null, "Fixture");
  editTask(data, id, { "custom:f-type": "type-task" });
  const item = materialize(data.remote, data.operations)[0];
  assert.ok(item);
  const remote = {
    ...item,
    id: "PMON-1",
    type: "Task",
    _custom: [{ id: "f-type", name: "Type" }],
  };
  assert.equal(matchesCreation(item, remote), true);
  assert.equal(
    matchesCreation(item, { ...remote, "custom:f-type": "other" }),
    false,
  );
  assert.equal(
    matchesCreation(item, {
      ...remote,
      _custom: [{ id: "other", name: "Type" }],
    }),
    false,
  );
});
