import assert from "node:assert/strict";
import test from "node:test";
import type { PointerEvent } from "react";
import { startTaskDrag } from "../../src/components/romdex/task-drag-start";
import { workspaceStore } from "../../src/domain/workspace-store";
import { trackWorkspaceWork } from "../../src/domain/workspace-work";
import { gate, setup } from "../fixtures/delivery-navigation";

test("desktop drag ignores unrelated checked locks except a genuine bulk grip gesture", async () => {
  const { store } = await setup();
  const data = structuredClone(store.getSnapshot().data);
  data.cloud = {
    autoSync: false,
    accountId: "synthetic",
    records: {
      [data.operations[0]!.opId]: {
        status: "uncertain",
        message: "Synthetic review",
      },
    },
  };
  const snapshot = workspaceStore.getSnapshot,
    tickets = workspaceStore.deliveryTickets;
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  workspaceStore.getSnapshot = () => ({ ...store.getSnapshot(), data });
  workspaceStore.deliveryTickets = () => new Set();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { querySelector: () => null },
  });
  let captures = 0;
  const event = (selector: boolean, id = "PMON-900002") =>
    ({
      pointerType: "mouse",
      button: 0,
      pointerId: 4,
      clientX: 100,
      clientY: 200,
      target: {
        closest: () => ({
          dataset: selector ? { select: id } : { drag: id },
          setPointerCapture: () => {
            captures++;
          },
        }),
      },
    }) as unknown as PointerEvent<HTMLElement>;
  try {
    assert.ok(startTaskDrag(event(false), ["PMON-900001"]));
    assert.ok(startTaskDrag(event(true), ["PMON-900001", "PMON-900002"]));
    assert.throws(
      () => startTaskDrag(event(false), ["PMON-900001", "PMON-900002"]),
      /checked ticket/,
    );
    assert.throws(
      () => startTaskDrag(event(false, "PMON-900001"), []),
      /synchronized or needs review/,
    );
    const held = gate();
    const pending = trackWorkspaceWork(() => held.promise);
    try {
      assert.ok(startTaskDrag(event(false), []));
    } finally {
      held.release();
      await pending;
    }
    assert.equal(captures, 3);
    for (const pointerType of ["touch", "pen", ""]) {
      const touch = { ...event(false), pointerType };
      assert.equal(startTaskDrag(touch, []), null);
    }
    assert.equal(captures, 3);
  } finally {
    workspaceStore.getSnapshot = snapshot;
    workspaceStore.deliveryTickets = tickets;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("drop waits for pending draft work and rejects a changed hierarchy without losing that draft", async () => {
  const { registerDraftEditor } =
    await import("../../src/domain/editor-drafts");
  const { commitTaskDrop } = await import("../../src/domain/task-drop-commit");
  const { hierarchySignature } = await import("../../src/domain/task-drop");
  const { store } = await setup();
  await store.change((data) => {
    data.operations = [];
  });
  const prior = {
    getSnapshot: workspaceStore.getSnapshot,
    change: workspaceStore.change,
    flush: workspaceStore.flush,
  };
  workspaceStore.getSnapshot = store.getSnapshot;
  workspaceStore.change = store.change;
  workspaceStore.flush = store.flush;
  const held = gate();
  let dirty = true;
  const unregister = registerDraftEditor({
    dirty: () => dirty,
    flush: async () => {
      await held.promise;
      await store.change((data) => {
        data.commentDrafts.keep = "Preserved pending draft";
        data.order["PMON-900001"] = 2;
      });
      dirty = false;
    },
  });
  try {
    const signature = hierarchySignature(store.getSnapshot().data);
    const moving = commitTaskDrop(
      { dragId: "PMON-900002", targetId: "PMON-900001", delta: 1, after: true },
      signature,
      () => true,
    );
    await Promise.resolve();
    assert.equal(store.getSnapshot().data.operations.length, 0);
    held.release();
    await assert.rejects(moving, /hierarchy changed/);
    assert.equal(
      store.getSnapshot().data.commentDrafts.keep,
      "Preserved pending draft",
    );
    assert.equal(store.getSnapshot().data.operations.length, 0);
    assert.equal(store.getSnapshot().data.remote[2]?.parentId, "PMON-900000");
  } finally {
    held.release();
    unregister();
    Object.assign(workspaceStore, prior);
  }
});

test("same-parent reorder survives an overlapping scalar delivery confirmation", async () => {
  const { deliverQueue } = await import("../../src/cloud/delivery");
  const { editTask } = await import("../../src/domain/task-actions");
  const { applyTaskDrop, hierarchySignature } =
    await import("../../src/domain/task-drop");
  const { navigationPort } = await import("../fixtures/navigation-port");
  const { store } = await setup();
  await store.change((data) => {
    data.operations = [];
    for (const item of data.remote) item.parentId = null;
    editTask(data, "PMON-900000", { priority: "High" });
  });
  const { port, sent } = navigationPort(store.getSnapshot().data.remote),
    get = port.get,
    started = gate(),
    resume = gate();
  port.get = async (id) => {
    started.release();
    await resume.promise;
    return get(id);
  };
  const running = store.deliver((commit) =>
    deliverQueue(() => store.getSnapshot().data, commit, port),
  );
  await started.promise;
  try {
    await store.change((data) => {
      applyTaskDrop(
        data,
        {
          dragId: "PMON-900001",
          targetId: "PMON-900002",
          delta: 0,
          after: true,
        },
        hierarchySignature(data),
      );
    });
    assert.deepEqual(store.getSnapshot().data.order, {
      "PMON-900000": 0,
      "PMON-900002": 1,
      "PMON-900001": 2,
    });
  } finally {
    resume.release();
  }
  await running;
  assert.deepEqual(store.getSnapshot().data.order, {
    "PMON-900000": 0,
    "PMON-900002": 1,
    "PMON-900001": 2,
  });
  assert.deepEqual(sent, ["PMON-900000"]);
  assert.equal(store.getSnapshot().data.operations.length, 0);
});
