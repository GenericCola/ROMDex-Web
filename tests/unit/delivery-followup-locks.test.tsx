import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { createTask, editTask } from "../../src/domain/task-actions";
import { gate, setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";
void test("created server ticket stays locked through followup GET while unrelated ticket remains editable", async () => {
  const { store, saved } = await setup(),
    started = gate(),
    resume = gate();
  await store.change((data) => {
    data.operations = [];
    createTask(data, "PMON-900000", "Synthetic child");
  });
  const { port, remote, sent } = navigationPort(
    store.getSnapshot().data.remote,
  );
  const serverId = "PMON-900010";
  port.create = (task) => {
    remote.set(serverId, {
      ...structuredClone(task),
      id: serverId,
      parentId: null,
      updated: 2,
    });
    return Promise.resolve({ id: serverId });
  };
  let reads = 0;
  port.get = async (id) => {
    if (id === serverId && ++reads === 2) {
      started.release();
      await resume.promise;
    }
    return structuredClone(remote.get(id) ?? null);
  };
  const running = store.deliver(async (commit) => {
    await deliverQueue(
      () => {
        return store.getSnapshot().data;
      },
      commit,
      port,
    );
  });
  try {
    await Promise.race([
      started.promise,
      running.then(() => {
        throw Error("Expected followup GET");
      }),
    ]);
    assert.equal(store.deliveryTickets().has(serverId), true);
    assert.throws(() => {
      void store.change((data) => {
        editTask(data, serverId, { priority: "Low" });
      });
    });
    await store.change((data) => {
      editTask(data, "PMON-900002", { description: "Independent next cycle" });
    });
  } finally {
    resume.release();
  }
  await running;
  assert.deepEqual(sent, [serverId]);
  assert.equal(saved().operations.length, 1);
  assert.equal(saved().operations[0]?.issueId, "PMON-900002");
});
void test("AutoSync OFF during awaited rollup planning prevents subsequent write", async () => {
  const { store, saved } = await setup(),
    started = gate(),
    resume = gate();
  await store.change((data) => {
    data.operations = [];
    data.cloud = { autoSync: true, rollupPending: true, records: {} };
    for (const item of data.remote)
      if (item.parentId) {
        item.state = "Done";
        item.assignedState = "Done";
      }
  });
  const { port, remote, sent } = navigationPort(
    store.getSnapshot().data.remote,
  );
  port.all = async () => {
    started.release();
    await resume.promise;
    return structuredClone([...remote.values()]);
  };
  const running = store.deliver(async (commit) => {
    await deliverQueue(
      () => {
        return store.getSnapshot().data;
      },
      commit,
      port,
      undefined,
      () => {
        return !!store.getSnapshot().data.cloud?.autoSync;
      },
    );
  });
  try {
    await started.promise;
    await store.change((data) => {
      data.cloud!.autoSync = false;
    });
  } finally {
    resume.release();
  }
  await running;
  assert.deepEqual(sent, []);
  assert.equal(saved().cloud?.autoSync, false);
  assert.equal(
    saved().operations.some((op) => {
      return op.type === "edit" && op.purpose === "rollup";
    }),
    true,
  );
});
