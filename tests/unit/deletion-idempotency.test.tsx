import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { recordDelivery } from "../../src/cloud/journal";
import { reviewDeletion } from "../../src/cloud/review-deletion";
import { cloudData } from "../../src/cloud/types";
import { deleteTask, editTask } from "../../src/domain/task-actions";
import { setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";
const fixture = async () => {
  const { store } = await setup();
  await store.change((data) => {
    data.operations = [];
    deleteTask(data, "PMON-900001");
    data.cloud = { ...cloudData(data), accountId: "synthetic-owner" };
  });
  const transport = navigationPort(store.getSnapshot().data.remote);
  const removed: string[] = [];
  transport.port.remove = async (id) => {
    removed.push(id);
    transport.remote.delete(id);
  };
  const run = () =>
    store.deliver((commit) =>
      deliverQueue(() => store.getSnapshot().data, commit, transport.port),
    );
  const op = store.getSnapshot().data.operations[0]!;
  assert.equal(op.type, "delete");
  if (op.type !== "delete") throw Error("fixture");
  return { store, ...transport, removed, run, op };
};
test("durable DELETE receipt plus authenticated absence clears queued intent without another DELETE", async () => {
  const s = await fixture();
  s.remote.delete(s.op.issueId);
  await s.store.change((data) =>
    recordDelivery(data, s.op.opId, {
      status: "uncertain",
      targetId: s.op.issueId,
      deleteReceipts: [s.op.issueId],
    }),
  );
  await s.run();
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
  assert.deepEqual(s.removed, []);
  assert.ok(
    cloudData(s.store.getSnapshot().data).records[s.op.opId]?.archivedOperation,
  );
});
test("external verified Gone outcome completes without mutation, but generic missing does not", async () => {
  const s = await fixture();
  s.remote.delete(s.op.issueId);
  await assert.rejects(s.run(), /deletion/);
  assert.equal(s.store.getSnapshot().data.operations.length, 1);
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: id === s.op.issueId,
  });
  await s.run();
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
  assert.deepEqual(s.removed, []);
});
test("ambiguous deletion isolates its dependencies while unrelated queued edits deliver", async () => {
  const s = await fixture();
  s.remote.delete(s.op.issueId);
  await s.store.change((data) =>
    editTask(data, "PMON-900002", { summary: "Independent" }),
  );
  await assert.rejects(s.run(), /deletion/);
  assert.deepEqual(s.sent, ["PMON-900002"]);
  assert.equal(s.store.getSnapshot().data.operations.length, 1);
  assert.deepEqual(s.removed, []);
});
test("explicit already-deleted confirmation is read-only and retains archived intent", async () => {
  const s = await fixture();
  s.remote.delete(s.op.issueId);
  await assert.rejects(s.run(), /deletion/);
  await s.store.deliver((commit) =>
    reviewDeletion(
      s.store.getSnapshot().data,
      s.op,
      "confirm",
      commit,
      s.port,
      true,
    ),
  );
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
  assert.deepEqual(s.removed, []);
  assert.deepEqual(
    cloudData(s.store.getSnapshot().data).records[s.op.opId]?.deletedIds,
    [s.op.issueId],
  );
});
test("lost DELETE response never resends blindly; verified Gone readback can finish it", async () => {
  const s = await fixture();
  s.port.remove = async (id) => {
    s.removed.push(id);
    s.remote.delete(id);
    throw Error("lost response");
  };
  await assert.rejects(s.run(), /uncertain/);
  await assert.rejects(s.run(), /uncertain/);
  assert.equal(s.removed.length, 1);
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: !s.remote.has(id),
  });
  await s.run();
  assert.equal(s.removed.length, 1);
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
});
test("unauthorized and network failures preserve deletion and never become absence", async () => {
  for (const message of ["401", "403", "offline"]) {
    const s = await fixture();
    s.port.get = async () => {
      throw Error(message);
    };
    await assert.rejects(s.run(), new RegExp(message));
    assert.equal(s.store.getSnapshot().data.operations.length, 1);
    assert.deepEqual(s.removed, []);
  }
});

test("mixed cascade skips already-gone child and deletes only remaining reviewed leaves", async () => {
  const s = await fixture();
  await s.store.change((data) => {
    data.operations = [];
    deleteTask(data, "PMON-900000");
  });
  s.remote.delete("PMON-900001");
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: id === "PMON-900001",
  });
  await s.run();
  assert.deepEqual(s.removed, ["PMON-900002", "PMON-900000"]);
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
});

test("confirmed missing parent refreshes surviving child rather than deleting or orphaning it", async () => {
  const s = await fixture();
  const child = {
    ...structuredClone(s.store.getSnapshot().data.remote[1]!),
    id: "PMON-900003",
    parentId: s.op.issueId,
  };
  await s.store.change((data) => {
    data.remote.push(child);
  });
  s.remote.set(child.id, { ...child, parentId: null, updated: 2 });
  s.remote.delete(s.op.issueId);
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: id === s.op.issueId,
  });
  await s.run();
  assert.equal(
    s.store.getSnapshot().data.remote.find((item) => item.id === child.id)
      ?.parentId,
    null,
  );
  assert.deepEqual(s.removed, []);
});

test("unverifiable surviving child prevents local deletion acknowledgement", async () => {
  const s = await fixture();
  const child = {
    ...structuredClone(s.store.getSnapshot().data.remote[1]!),
    id: "PMON-900003",
    parentId: s.op.issueId,
  };
  await s.store.change((data) => {
    data.remote.push(child);
  });
  s.remote.delete(s.op.issueId);
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: id === s.op.issueId,
  });
  await assert.rejects(s.run(), /surviving child/);
  assert.equal(s.store.getSnapshot().data.operations.length, 1);
  assert.deepEqual(s.removed, []);
});
