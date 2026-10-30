import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { acknowledge } from "../../src/cloud/journal";
import type { DeliveryPort } from "../../src/cloud/types";
import { editTask } from "../../src/domain/task-actions";
import { gate, setup } from "../fixtures/delivery-navigation";
void test("held delivery permits navigation and sibling edits while protecting active operation and receipt", async () => {
  const { store, saved } = await setup(),
    started = gate(),
    resume = gate();
  const original = structuredClone(store.getSnapshot().data.operations[0]!);
  const running = store.deliver(async (commit) => {
    started.release();
    await resume.promise;
    await commit((data) => {
      acknowledge(data, original);
    });
  });
  try {
    await started.promise;
    assert.equal(store.getSnapshot().delivering, true);
    await store.change((data) => {
      data.view.selected = "PMON-900002";
      data.view.search = "Sibling";
    });
    await store.change((data) => {
      editTask(data, "PMON-900002", { description: "Queued next" });
      data.commentDrafts["PMON-900002"] = "Unposted";
    });
    assert.throws(() => {
      void store.change((data) => {
        editTask(data, "PMON-900001", { priority: "Low" });
      });
    });
    assert.deepEqual(store.getSnapshot().data.operations[0], original);
  } finally {
    resume.release();
  }
  await running;
  assert.equal(saved().view.selected, "PMON-900002");
  assert.equal(saved().commentDrafts["PMON-900002"], "Unposted");
  assert.equal(saved().operations.length, 1);
  assert.equal(saved().operations[0]?.issueId, "PMON-900002");
  assert.equal(saved().cloud?.records[original.opId]?.status, "confirmed");
  assert.equal(store.getSnapshot().delivering, false);
});
void test("unrelated edit queued during real delivery preflight survives for next batch", async () => {
  const { store, saved } = await setup(),
    started = gate(),
    resume = gate();
  const remote = new Map(
    store.getSnapshot().data.remote.map((task) => {
      return [task.id, structuredClone(task)];
    }),
  );
  const sent: string[] = [];
  let held = false;
  const forbidden = (): Promise<never> => {
    return Promise.reject(Error("Unexpected fixture operation"));
  };
  const port: DeliveryPort = {
    accountId: "synthetic-owner",
    all: () => {
      return Promise.resolve(structuredClone([...remote.values()]));
    },
    get: async (id) => {
      if (!held) {
        held = true;
        started.release();
        await resume.promise;
      }
      return structuredClone(remote.get(id) ?? null);
    },
    update: (id, patch) => {
      const current = remote.get(id);
      assert.ok(current);
      sent.push(id);
      Object.assign(current, patch);
      return Promise.resolve();
    },
    children: () => {
      return Promise.resolve([]);
    },
    create: forbidden,
    prepareCreate: forbidden,
    remove: forbidden,
    comment: forbidden,
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
    await started.promise;
    await store.change((data) => {
      data.view.selected = "PMON-900002";
      editTask(data, "PMON-900002", { description: "Next cycle" });
    });
  } finally {
    resume.release();
  }
  await running;
  assert.deepEqual(sent, ["PMON-900001"]);
  assert.equal(saved().operations.length, 1);
  assert.equal(saved().operations[0]?.issueId, "PMON-900002");
  assert.equal(saved().view.selected, "PMON-900002");
  assert.equal(
    saved().remote.find((task) => {
      return task.id === "PMON-900001";
    })?.priority,
    "High",
  );
});
