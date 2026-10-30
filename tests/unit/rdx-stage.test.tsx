import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { writeRdx } from "../../src/rdx/container";
import { previewBrowserPlan } from "../../src/rdx/plan-publication";
import { preparePlanStage } from "../../src/rdx/stage-plan";
import { planDocument } from "../fixtures/rdx";
void test("reviewed plan atomically stages operations and portable bindings without touching NPCDex", async () => {
  const bytes = await writeRdx(planDocument(), new Map());
  const data = emptyWorkspace();
  data.npcdex = { version: 2, towns: [], opaque: "preserve" };
  const request = { state: data, connection: { project: "PMON" } };
  const reviewed = await previewBrowserPlan(bytes, request);
  assert.equal(typeof reviewed.preview.token, "string");
  const prepared = await preparePlanStage(
    bytes,
    request,
    reviewed.preview.token as string,
  );
  prepared.stage(data);
  assert.equal(data.operations.length, 1);
  assert.equal(Object.keys(data.rdxImports ?? {}).length, 1);
  assert.deepEqual(data.npcdex, { version: 2, towns: [], opaque: "preserve" });
});
void test("a stale plan review cannot queue against an edited workspace", async () => {
  const bytes = await writeRdx(planDocument(), new Map());
  const data = emptyWorkspace(),
    request = { state: data, connection: { project: "PMON" } };
  const reviewed = await previewBrowserPlan(bytes, request);
  const prepared = await preparePlanStage(
    bytes,
    request,
    reviewed.preview.token as string,
  );
  data.view.search = "changed after review";
  assert.throws(() => {
    prepared.stage(data);
  }, /workspace changed/);
  assert.equal(data.operations.length, 0);
  await assert.rejects(
    preparePlanStage(bytes, request, "wrong-token"),
    /Review the publication again/,
  );
});
