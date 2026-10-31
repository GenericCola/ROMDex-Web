import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { recordDelivery } from "../../src/cloud/journal";
import { reviewDeletion } from "../../src/cloud/review-deletion";
import { cloudData } from "../../src/cloud/types";
import { deleteTask, editTask } from "../../src/domain/task-actions";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
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
test("full-snapshot absence retires intent without claiming proven deletion; Gone remains proven", async () => {
  for (const gone of [false, true]) {
    const s = await fixture();
    s.remote.delete(s.op.issueId);
    s.port.deletionState = async (id) => ({ item: await s.port.get(id), gone });
    await s.run();
    const data = s.store.getSnapshot().data;
    const record = cloudData(data).records[s.op.opId]!;
    assert.equal(data.operations.length, 0);
    assert.deepEqual(record.retiredIds ?? [], gone ? [] : [s.op.issueId]);
    assert.deepEqual(record.deletedIds ?? [], gone ? [s.op.issueId] : []);
    assert.deepEqual(record.archivedOperation, s.op);
    assert.deepEqual(s.removed, []);
  }
});
test("ambiguous deletion isolates its dependencies while unrelated queued edits deliver", async () => {
  const s = await fixture();
  const get = s.port.get;
  s.port.get = async (id) => (id === s.op.issueId ? null : get(id));
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
  await s.store.change((data) =>
    recordDelivery(data, s.op.opId, {
      status: "conflict",
      message: "Legacy missing target",
    }),
  );
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
test("lost DELETE response is retired after full-snapshot absence without resending", async () => {
  const s = await fixture();
  s.port.remove = async (id) => {
    s.removed.push(id);
    s.remote.delete(id);
    throw Error("lost response");
  };
  await assert.rejects(s.run(), /uncertain/);
  await s.run();
  assert.equal(s.removed.length, 1);
  assert.equal(s.store.getSnapshot().data.operations.length, 0);
});
test("unauthorized and network failures preserve deletion and never become absence", async () => {
  for (const message of ["401", "403", "offline"]) {
    const s = await fixture();
    s.port.get = async () => {
      throw message === "offline"
        ? Error(message)
        : new YouTrackHttpError(Number(message));
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

test("a child present in the full snapshot but individually unreadable prevents acknowledgement", async () => {
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
  s.remote.set(child.id, child);
  const get = s.port.get;
  s.port.get = async (id) => (id === child.id ? null : get(id));
  s.port.deletionState = async (id) => ({
    item: await s.port.get(id),
    gone: id === s.op.issueId,
  });
  await assert.rejects(s.run(), /surviving child/);
  assert.equal(s.store.getSnapshot().data.operations.length, 1);
  assert.deepEqual(s.removed, []);
});

test("failed or malformed full snapshots never retire missing targets or lose pending work", async () => {
  for (const kind of ["401", "403", "partial-page-error", "duplicate"]) {
    const s = await fixture();
    s.remote.delete(s.op.issueId);
    await s.store.change((data) => {
      data.commentDrafts["PMON-900002"] = "Retained draft";
      data.order["PMON-900002"] = 9;
    });
    const before = structuredClone(s.store.getSnapshot().data);
    const all = s.port.all;
    s.port.all = async () => {
      if (kind === "duplicate") {
        const rows = await all();
        return [...rows, rows[0]!];
      }
      throw kind === "401" || kind === "403"
        ? new YouTrackHttpError(Number(kind))
        : Error(kind);
    };
    await assert.rejects(
      s.run(),
      kind === "duplicate" ? /duplicate/i : new RegExp(kind),
    );
    const data = s.store.getSnapshot().data;
    assert.deepEqual(data.operations, before.operations);
    assert.deepEqual(data.remote, before.remote);
    assert.deepEqual(data.commentDrafts, before.commentDrafts);
    assert.deepEqual(data.order, before.order);
    assert.deepEqual(cloudData(data).records[s.op.opId]?.retiredIds ?? [], []);
    assert.deepEqual(s.removed, []);
  }
});
