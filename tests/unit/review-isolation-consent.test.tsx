import assert from "node:assert/strict";
import test from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { rebaseEdit } from "../../src/cloud/rebase-edit";
import { reviewQueue } from "../../src/cloud/review";
import { cloudData } from "../../src/cloud/types";
import type { WorkspaceData } from "../../src/domain/types";
import { validateWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { A, B, fixture } from "../fixtures/review-isolation";
void test("actual local review choice stays ready while unrelated auto work sends; explicit Save sends it", async () => {
  const f = await fixture(),
    held = f.edit(A, "held");
  await f.store.change((data) => {
    data.operations = [held, f.independent("scalar")];
    data.cloud!.records.held = {
      status: "conflict",
      message: "Choose local or remote",
    };
  });
  await f.store.deliver((commit) => {
    return reviewQueue(
      f.state(),
      commit,
      {
        ...f.port,
        verifyComment: () => {
          return Promise.reject(Error("Unexpected comment read"));
        },
      },
      held.opId,
      "local",
    );
  });
  assert.equal(cloudData(f.state()).records.held?.status, "ready");
  assert.deepEqual(f.sent(), []);
  await f.run(true);
  assert.deepEqual(f.sent(), ["scalar:" + B]);
  assert.deepEqual(
    f.state().operations.map((op) => {
      return op.opId;
    }),
    ["held"],
  );
  assert.equal(automaticBatch(f.state())?.size, 0);
  await f.run();
  assert.deepEqual(f.sent(), ["scalar:" + B, "scalar:" + A]);
  assert.equal(f.state().operations.length, 0);
});
for (const branch of ["ordinary", "tags", "shared"]) {
  void test(`${branch} rebase persists a validated ready receipt across reopen and never auto-selects it`, async () => {
    const f = await fixture(),
      data = structuredClone(f.state()),
      op = f.edit(A, "held");
    if (op.type !== "edit") throw Error("fixture");
    if (branch === "tags") {
      op.base.tags = ["old"];
      op.patch = { tags: ["new"] };
    }
    if (branch === "shared") {
      data.cloud!.sharedStatuses = true;
      for (const item of data.remote)
        item.sharedStatus = {
          schema: 1,
          id: item.id,
          revision: 0,
          initialized: false,
          assignedState: item.assignedState!,
          state: item.state,
          updated: item.updated!,
          receipt: null,
        };
    }
    const remote = structuredClone(
      data.remote.find((item) => {
        return item.id === A;
      })!,
    );
    if (branch === "tags") remote.tags = ["remote"];
    data.operations = [op, f.independent("scalar")];
    data.cloud!.records.held = {
      status: "uncertain",
      message: "Retained previous outcome",
    };
    rebaseEdit(data, op.opId, remote);
    const result = data.operations.find((item) => {
      return item.issueId === A;
    })!;
    assert.equal(data.cloud!.records[result.opId]?.status, "ready");
    assert.deepEqual(automaticBatch(data), new Set(["safe"]));
    if (branch !== "ordinary") {
      assert.notEqual(result.opId, op.opId);
      assert.equal(data.cloud!.records.held?.status, "confirmed");
      assert.deepEqual(data.cloud!.records.held?.archivedOperation, op);
    }
    const restored = JSON.parse(JSON.stringify(data)) as WorkspaceData;
    validateWorkspace(restored);
    const reopened = new WorkspaceStore({
      load: () => {
        return Promise.resolve({ data: restored, revision: 1 });
      },
      save: () => {
        return Promise.reject(Error("No write expected while reopening"));
      },
    });
    await reopened.start();
    assert.equal(reopened.getSnapshot().error, "");
    assert.equal(
      cloudData(reopened.getSnapshot().data).records[result.opId]?.status,
      "ready",
    );
    assert.deepEqual(
      automaticBatch(reopened.getSnapshot().data),
      new Set(["safe"]),
    );
  });
}
