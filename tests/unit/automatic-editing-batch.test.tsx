import assert from "node:assert/strict";
import test from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { deliverQueue } from "../../src/cloud/delivery";
import { editTask } from "../../src/domain/task-actions";
import { setTaskTextEditing } from "../../src/domain/task-editing";
import { gate, setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";

test("automatic delivery skips typing ticket, delivers independent edit and retains continued typing", async () => {
  const { store } = await setup();
  await store.change((data) =>
    editTask(data, "PMON-900002", { summary: "Independent" }),
  );
  const key = "PMON-900001:notes";
  setTaskTextEditing(key, true);
  const { port, sent } = navigationPort(store.getSnapshot().data.remote);
  const started = gate(),
    resume = gate(),
    get = port.get;
  port.get = async (id) => {
    started.release();
    await resume.promise;
    return get(id);
  };
  const selected = automaticBatch(store.getSnapshot().data);
  assert.equal(selected?.size, 1);
  const run = store.deliver(
    (commit) =>
      deliverQueue(
        () => store.getSnapshot().data,
        commit,
        port,
        undefined,
        () => true,
        selected,
      ),
    selected,
  );
  await started.promise;
  try {
    assert.deepEqual([...store.deliveryTickets()], ["PMON-900002"]);
    await store.change((data) =>
      editTask(data, "PMON-900001", { description: "Still typing" }),
    );
  } finally {
    resume.release();
  }
  await run;
  assert.deepEqual(sent, ["PMON-900002"]);
  assert.equal(store.getSnapshot().data.operations.length, 1);
  assert.equal(automaticBatch(store.getSnapshot().data)?.size, 0);
  setTaskTextEditing(key, false);
  assert.equal(automaticBatch(store.getSnapshot().data), undefined);
  await store.deliver((commit) =>
    deliverQueue(() => store.getSnapshot().data, commit, port),
  );
  assert.equal(store.getSnapshot().data.operations.length, 0);
  assert.deepEqual(sent, ["PMON-900002", "PMON-900001"]);
});

test("explicit Save bypasses a typing lease but refuses unfinished IME composition", async () => {
  const { saveDelivery } = await import("../../src/cloud/session");
  const { setTaskComposition } = await import("../../src/domain/task-editing");
  const key = "PMON-900001:notes";
  setTaskComposition(key, true);
  try {
    await assert.rejects(saveDelivery(), /Finish composing/);
  } finally {
    setTaskComposition(key, false);
    setTaskTextEditing(key, false);
  }
  const { store } = await setup();
  const { port, sent } = navigationPort(store.getSnapshot().data.remote);
  setTaskTextEditing(key, true);
  try {
    assert.equal(automaticBatch(store.getSnapshot().data)?.size, 0);
    await store.deliver((commit) =>
      deliverQueue(() => store.getSnapshot().data, commit, port),
    );
    assert.deepEqual(sent, ["PMON-900001"]);
    assert.equal(store.getSnapshot().data.operations.length, 0);
  } finally {
    setTaskTextEditing(key, false);
  }
});

test("mixed scoped and unscoped dirty editors retain the conservative unknown-ticket hold", async () => {
  const { registerDraftEditor } =
    await import("../../src/domain/editor-drafts");
  const { store } = await setup();
  const scoped = registerDraftEditor({
    ticketIds: ["PMON-900002"],
    dirty: () => true,
    flush: async () => {},
  });
  const unscoped = registerDraftEditor({
    dirty: () => true,
    flush: async () => {},
  });
  try {
    assert.equal(automaticBatch(store.getSnapshot().data)?.size, 0);
    unscoped();
    assert.equal(automaticBatch(store.getSnapshot().data)?.size, 1);
  } finally {
    scoped();
    unscoped();
  }
});
