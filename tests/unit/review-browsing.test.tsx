import assert from "node:assert/strict";
import test from "node:test";
import { needsDeliveryReview } from "../../src/domain/review-browsing";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
test("conflict permits tray navigation but preserves queue, task and journal snapshots", async () => {
  const data = emptyWorkspace();
  data.operations.push({
    type: "comment",
    opId: "held",
    issueId: "PMON-499",
    text: "fixture",
    created: 1,
  });
  data.cloud = {
    autoSync: false,
    accountId: "fixture-account",
    records: { held: { status: "conflict", message: "Review" } },
  };
  let revision = 0;
  const store = new WorkspaceStore({
    load: async () => {
      return { revision, data };
    },
    save: async () => {
      return ++revision;
    },
  });
  await store.start();
  assert.equal(needsDeliveryReview(store.getSnapshot().data), true);
  await store.change((next) => {
    next.view.scope = "PMON-499";
    next.view.selected = "PMON-499";
    next.view.expanded = ["PMON-499"];
  });
  assert.equal(store.getSnapshot().data.view.selected, "PMON-499");
  const before = structuredClone(store.getSnapshot().data);
  assert.throws(() => {
    return store.change((next) => {
      next.operations = [];
    });
  }, /ticket.*review/);
  assert.throws(() => {
    return store.change((next) => {
      next.cloud!.records = {};
    });
  }, /ticket.*review/);
  assert.throws(() => {
    return store.change((next) => {
      next.commentDrafts["PMON-499"] = "overwrite";
    });
  }, /ticket.*review/);
  assert.deepEqual(store.getSnapshot().data, before);
  await store.change((next) => {
    next.cloud!.autoSync = true;
    next.cloud!.accountId = "fixture-account";
  });
  assert.equal(store.getSnapshot().data.cloud!.autoSync, true);
  await store.deliver(async (commit) => {
    await commit((next) => {
      next.cloud!.records.held!.status = "confirmed";
      next.operations = [];
    });
  });
  assert.equal(needsDeliveryReview(store.getSnapshot().data), false);
});
