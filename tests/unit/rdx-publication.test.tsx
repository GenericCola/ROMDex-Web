import assert from "node:assert/strict";
import test from "node:test";
import { jsonObject } from "../../src/domain/json";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { documentRevision, writeRdx } from "../../src/rdx/container";
import { previewBrowserPlan } from "../../src/rdx/plan-publication";
import { planDocument } from "../fixtures/rdx";
void test("original plan publication previews stable local operations without mutating workspace", async () => {
  const bytes = await writeRdx(planDocument(), new Map());
  const state = emptyWorkspace(),
    before = structuredClone(state);
  const request = { state, connection: { project: "PMON" } };
  const first = await previewBrowserPlan(bytes, request);
  const second = await previewBrowserPlan(bytes, request);
  assert.equal(first.preview.ready, true);
  assert.equal(first.preview.operationCount, 1);
  assert.deepEqual(first.batch, second.batch);
  assert.deepEqual(state, before);
  const operation = jsonObject((first.batch.operations as never[])[0]);
  assert.equal(operation.type, "create");
  assert.ok(typeof operation.issueId === "string");
  assert.match(operation.issueId, /^local-rdx-/);
});
void test("publication requires the destination project and explicitly blocks unsupported editable fields", async () => {
  const document = planDocument();
  const task = jsonObject((jsonObject(document.content).tasks as never[])[0]);
  task.fields = [
    {
      key: "custom:fixture",
      type: "string",
      value: "retain me",
      readOnly: false,
    },
  ];
  document.revision = documentRevision(document);
  const bytes = await writeRdx(document, new Map());
  const result = await previewBrowserPlan(bytes, {
    state: emptyWorkspace(),
    connection: null,
  });
  assert.equal(result.preview.ready, false);
  assert.match(JSON.stringify(result.preview.blockers), /Connect to PMON/);
  assert.match(
    JSON.stringify(result.preview.blockers),
    /supported web field adapter/,
  );
  assert.equal(
    jsonObject((jsonObject(document.content).tasks as never[])[0]).fields
      ?.length,
    1,
  );
});
