import assert from "node:assert/strict";
import test from "node:test";
import { jsonObject, type JsonObject } from "../../src/domain/json";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { documentRevision, writeRdx } from "../../src/rdx/container";
import { previewBrowserPlan } from "../../src/rdx/plan-publication";
import { planDocument } from "../fixtures/rdx";
const planWithField = async (field: JsonObject) => {
  const document = planDocument();
  jsonObject((jsonObject(document.content).tasks as JsonObject[])[0]).fields = [
    field,
  ];
  document.revision = documentRevision(document);
  return writeRdx(document, new Map());
};
const period = {
  id: "f-period",
  key: "custom:f-period",
  name: "Estimate",
  type: "period",
  multi: false,
  choices: false,
  options: [],
  canBeEmpty: true,
  readOnly: false,
};
void test("original RDX mapping produces supported native period operations without dropping its portable value", async () => {
  const bytes = await planWithField({
    key: "custom:estimate",
    type: "period",
    value: { minutes: 90 },
    readOnly: false,
  });
  const result = await previewBrowserPlan(bytes, {
    state: emptyWorkspace(),
    connection: { project: "PMON" },
    options: { custom: [period] },
    mappings: { "custom:estimate": { target: "custom:f-period", values: {} } },
  });
  assert.equal(result.preview.ready, true);
  const operation = jsonObject((result.batch.operations as JsonObject[])[0]);
  assert.equal(jsonObject(operation.item)["custom:f-period"], 90);
  assert.equal(operation.type, "create");
  const readonly = await previewBrowserPlan(bytes, {
    state: emptyWorkspace(),
    connection: { project: "PMON" },
    options: { custom: [{ ...period, readOnly: true }] },
    mappings: { "custom:estimate": { target: "custom:f-period", values: {} } },
  });
  assert.equal(readonly.preview.ready, false);
});
void test("RDX tag mappings remain gated even if a caller supplies ready tag options", async () => {
  const bytes = await planWithField({
    key: "custom:labels",
    type: "multi-enum",
    value: [{ optionKey: "portable-one", label: "One" }],
    readOnly: false,
  });
  const result = await previewBrowserPlan(bytes, {
    state: emptyWorkspace(),
    connection: { project: "PMON" },
    options: { tags: { ready: true, options: [{ id: "tag-1", name: "One" }] } },
    mappings: {
      "custom:labels": { target: "tags", values: { "portable-one": "tag-1" } },
    },
  });
  assert.equal(result.preview.ready, false);
  assert.match(JSON.stringify(result.preview.blockers), /per-tag/);
});
