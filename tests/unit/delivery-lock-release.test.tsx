import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { acknowledge, recordDelivery } from "../../src/cloud/journal";
import { cloudData } from "../../src/cloud/types";
import { deliveryTicketLocks } from "../../src/domain/delivery-locks";
import { deleteTask, editTask } from "../../src/domain/task-actions";
import {
  guardTicketChanges,
  reviewedTicketIds,
} from "../../src/domain/ticket-locks";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { gate, setup } from "../fixtures/delivery-navigation";
import { navigationPort } from "../fixtures/navigation-port";

test("confirmed ticket unlocks while next ticket waits; newer edit survives older batch", async () => {
  const { store } = await setup();
  await store.change((data) => {
    editTask(data, "PMON-900002", { summary: "Second" });
  });
  const { port, sent } = navigationPort(store.getSnapshot().data.remote);
  const started = gate(),
    resume = gate(),
    get = port.get;
  port.get = async (id) => {
    if (id === "PMON-900002") {
      started.release();
      await resume.promise;
    }
    return get(id);
  };
  const run = store.deliver((commit) =>
    deliverQueue(() => store.getSnapshot().data, commit, port),
  );
  await started.promise;
  try {
    assert.equal(store.getSnapshot().delivering, true);
    assert.equal(store.deliveryTickets().has("PMON-900001"), false);
    assert.equal(store.deliveryTickets().has("PMON-900002"), true);
    await store.change((data) => {
      editTask(data, "PMON-900001", { summary: "Newer retained edit" });
    });
    assert.throws(() =>
      store.change((data) => {
        deleteTask(data, "PMON-900002");
      }),
    );
  } finally {
    resume.release();
  }
  await run;
  const newer = store
    .getSnapshot()
    .data.operations.find((op) => op.issueId === "PMON-900001");
  assert.ok(newer?.type === "edit");
  assert.equal(newer.patch.summary, "Newer retained edit");
  assert.deepEqual(sent, ["PMON-900001", "PMON-900002"]);
});

test("multiple operations on one ticket retain lock until all are acknowledged", async () => {
  const { store } = await setup();
  await store.change((data) => {
    data.operations.push({
      type: "comment",
      created: 1,
      opId: "second-op",
      issueId: "PMON-900001",
      text: "Retain comment",
    });
  });
  await store.deliver(async (commit) => {
    const first = store.getSnapshot().data.operations[0]!;
    await commit((data) => acknowledge(data, first));
    assert.equal(store.deliveryTickets().has("PMON-900001"), true);
    assert.throws(() =>
      store.change((data) => {
        deleteTask(data, "PMON-900001");
      }),
    );
    const second = store.getSnapshot().data.operations[0]!;
    await commit((data) => acknowledge(data, second));
    assert.equal(store.deliveryTickets().has("PMON-900001"), false);
    await store.change((data) => {
      deleteTask(data, "PMON-900001");
    });
  });
  assert.equal(store.getSnapshot().data.operations[0]?.type, "delete");
});

test("rollup keeps its own subtree guarded, not unrelated confirmed tickets", async () => {
  const { store } = await setup();
  const data = structuredClone(store.getSnapshot().data),
    op = data.operations[0]!;
  assert.equal(op.type, "edit");
  if (op.type !== "edit") return;
  op.purpose = "rollup";
  op.issueId = "PMON-900000";
  const locks = deliveryTicketLocks(data, new Set());
  assert.deepEqual([...locks].sort(), [
    "PMON-900000",
    "PMON-900001",
    "PMON-900002",
  ]);
  data.operations = [];
  assert.equal(deliveryTicketLocks(data, new Set()).size, 0);
});

test("acknowledged ticket stays locked until its local receipt is durable", async () => {
  const source = await setup(),
    started = gate(),
    resume = gate();
  const data = structuredClone(source.store.getSnapshot().data);
  const store = new WorkspaceStore({
    load: async () => ({ data, revision: 0 }),
    save: async (_data, revision) => {
      started.release();
      await resume.promise;
      return revision + 1;
    },
  });
  await store.start();
  const operation = data.operations[0]!;
  const running = store.deliver(async (commit) => {
    await commit((next) => acknowledge(next, operation));
  });
  await started.promise;
  assert.equal(store.deliveryTickets().has(operation.issueId), true);
  resume.release();
  await running;
  assert.equal(store.deliveryTickets().size, 0);
});

test("failed/uncertain delivery releases running state but retains review protection", async () => {
  const { store } = await setup();
  await store.change((data) => {
    data.cloud = { autoSync: false, records: {}, accountId: "synthetic-owner" };
  });
  const operation = store.getSnapshot().data.operations[0]!;
  await assert.rejects(
    store.deliver(async (commit) => {
      await commit((data) =>
        recordDelivery(data, operation.opId, {
          status: "uncertain",
          message: "Synthetic lost reply",
        }),
      );
      throw Error("Synthetic failure");
    }),
    /Synthetic failure/,
  );
  assert.equal(store.getSnapshot().delivering, false);
  assert.equal(store.deliveryTickets().size, 0);
  assert.equal(
    reviewedTicketIds(store.getSnapshot().data).has(operation.issueId),
    true,
  );
  assert.throws(
    () =>
      store.change((data) => {
        deleteTask(data, operation.issueId);
      }),
    /Review cloud delivery/,
  );
  const { port, sent } = navigationPort(store.getSnapshot().data.remote);
  await assert.rejects(
    store.deliver((commit) =>
      deliverQueue(() => store.getSnapshot().data, commit, port),
    ),
    /uncertain/,
  );
  assert.deepEqual(sent, []);
  assert.equal(store.getSnapshot().data.operations.length, 1);
});

test("confirmed ticket can queue deletion during later batch without sending it early", async () => {
  const { store } = await setup();
  await store.change((data) => {
    editTask(data, "PMON-900002", { summary: "Second" });
  });
  const { port, sent, remote } = navigationPort(
    store.getSnapshot().data.remote,
  );
  const started = gate(),
    resume = gate(),
    get = port.get;
  port.get = async (id) => {
    if (id === "PMON-900002") {
      started.release();
      await resume.promise;
    }
    return get(id);
  };
  const running = store.deliver((commit) =>
    deliverQueue(() => store.getSnapshot().data, commit, port),
  );
  await started.promise;
  try {
    await store.change((data) => {
      deleteTask(data, "PMON-900001");
    });
  } finally {
    resume.release();
  }
  await running;
  assert.deepEqual(sent, ["PMON-900001", "PMON-900002"]);
  const pending = store.getSnapshot().data.operations;
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.type, "delete");
  assert.equal(pending[0]?.issueId, "PMON-900001");
  const deleted: string[] = [];
  port.remove = async (id) => {
    deleted.push(id);
    remote.delete(id);
  };
  await store.deliver((commit) =>
    deliverQueue(() => store.getSnapshot().data, commit, port),
  );
  assert.deepEqual(deleted, ["PMON-900001"]);
  assert.equal(store.getSnapshot().data.operations.length, 0);
  assert.equal(store.getSnapshot().data.cloud?.rollupPending, false);
  assert.equal(
    store.getSnapshot().data.remote.some((item) => item.id === "PMON-900001"),
    false,
  );
  assert.equal(
    store.getSnapshot().data.remote.find((item) => item.id === "PMON-900002")
      ?.summary,
    "Second",
  );
});

test("sibling deletion preserves parent/ancestor and reviewed dependency protection", async () => {
  const { store } = await setup();
  const before = structuredClone(store.getSnapshot().data);
  before.cloud = cloudData(before);
  const after = structuredClone(before);
  deleteTask(after, "PMON-900002");
  assert.doesNotThrow(() =>
    guardTicketChanges(before, after, new Set(["PMON-900001"])),
  );
  assert.throws(() =>
    guardTicketChanges(before, after, new Set(["PMON-900000"])),
  );
  const ancestor = structuredClone(before);
  ancestor.operations.push({
    type: "edit",
    opId: "move-root",
    issueId: "PMON-900000",
    base: structuredClone(before.remote[0]!),
    patch: { parentId: null },
  });
  assert.throws(() =>
    guardTicketChanges(before, ancestor, new Set(["PMON-900001"])),
  );
  const ordered = structuredClone(before);
  // Deliberately malformed external data exercises the runtime guard.
  Object.assign(ordered.order, {
    "PMON-900001": ["Synthetic invalid order mutation"],
  });
  assert.throws(() =>
    guardTicketChanges(before, ordered, new Set(["PMON-900001"])),
  );
  const reviewed = structuredClone(before);
  reviewed.operations.push({
    type: "edit",
    opId: "parent-review",
    issueId: "PMON-900000",
    base: structuredClone(before.remote[0]!),
    patch: { summary: "Parent pending" },
  });
  reviewed.cloud = {
    autoSync: false,
    accountId: "synthetic-owner",
    records: {
      "parent-review": { status: "uncertain", message: "Needs review" },
    },
  };
  const proposed = structuredClone(reviewed);
  deleteTask(proposed, "PMON-900002");
  assert.throws(() =>
    guardTicketChanges(reviewed, proposed, reviewedTicketIds(reviewed)),
  );
});
