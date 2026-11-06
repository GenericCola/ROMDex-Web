import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  refreshTaskDrag,
  scrollTaskDrag,
} from "../../src/components/romdex/task-drag-navigation";
import type { DragPoint } from "../../src/components/romdex/task-drag-preview";
import type { Drag } from "../../src/components/romdex/task-drag-state";
import { registerDraftEditor } from "../../src/domain/editor-drafts";
import { createTask } from "../../src/domain/task-actions";
import {
  hierarchySignature,
  type DropTarget,
} from "../../src/domain/task-drop";
import { commitExactTaskMove } from "../../src/domain/task-move";
import { workspaceStore } from "../../src/domain/workspace-store";
import { gate, setup } from "../fixtures/delivery-navigation";

const installGlobal = (t: TestContext, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else Reflect.deleteProperty(globalThis, key);
  });
};
const connectStore = async (t: TestContext) => {
  const { store } = await setup();
  t.mock.method(workspaceStore, "getSnapshot", store.getSnapshot);
  t.mock.method(workspaceStore, "change", store.change);
  t.mock.method(workspaceStore, "flush", store.flush);
  t.mock.method(workspaceStore, "deliveryTickets", () => new Set<string>());
  return store;
};

test("hover expands once after 650ms and the next stationary refresh anchors after revealed descendants", async (t) => {
  const store = await connectStore(t);
  let dragId = "";
  await store.change((data) => {
    dragId = createTask(data, null, "Moving task");
    data.view.expanded = [];
  });
  const parent = "PMON-900000";
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const row = {
    dataset: { row: parent },
    getBoundingClientRect: () => ({ top: 100, height: 50 }),
  };
  let hit: typeof row | null = row;
  installGlobal(t, "document", {
    elementFromPoint: () => ({ closest: () => hit }),
  });
  const point = {
    clientX: 130,
    clientY: 130,
    shiftKey: false,
    currentTarget: {
      contains: () => true,
      querySelectorAll: () =>
        (store.getSnapshot().data.view.expanded.includes(parent)
          ? [parent, "PMON-900001", "PMON-900002", dragId]
          : [parent, dragId]
        ).map((id) => ({ dataset: { row: id } })),
    },
  } as unknown as DragPoint;
  const drag: Drag = {
    id: dragId,
    x: 100,
    y: 0,
    pointer: 1,
    active: true,
    intent: null,
    signature: hierarchySignature(store.getSnapshot().data),
  };
  const hover: { current: { id: string; since: number } | null } = {
    current: null,
  };
  const previews: (DropTarget | null)[] = [];
  const messages: string[] = [];
  const refresh = () =>
    refreshTaskDrag(
      point,
      drag,
      hover,
      (value) => previews.push(value),
      (value) => messages.push(value),
      { current: true },
    );
  refresh();
  assert.deepEqual(hover.current, { id: parent, since: 1000 });
  assert.equal(previews.at(-1)?.anchorId, parent);
  now = 1649;
  refresh();
  assert.deepEqual(store.getSnapshot().data.view.expanded, []);
  now = 1650;
  refresh();
  assert.equal(hover.current?.since, Infinity);
  assert.deepEqual(store.getSnapshot().data.view.expanded, [parent]);
  refresh();
  assert.equal(previews.at(-1)?.anchorId, "PMON-900002");
  assert.equal(previews.at(-1)?.parentId, parent);
  assert.equal(hover.current, null);
  now = 3000;
  refresh();
  assert.deepEqual(store.getSnapshot().data.view.expanded, [parent]);
  assert.match(messages.at(-1)!, /Under Synthetic/);
  hit = null;
  refresh();
  assert.equal(drag.intent, null);
  assert.equal(previews.at(-1), null);
  assert.equal(hover.current, null);
  await store.flush();
});

test("leaving a collapsed hover resets its timer and Shift clears nesting intent", async (t) => {
  const store = await connectStore(t);
  const parent = "PMON-900000";
  let now = 0;
  t.mock.method(Date, "now", () => now);
  let hit = true;
  const row = {
    dataset: { row: parent },
    getBoundingClientRect: () => ({ top: 100, height: 50 }),
  };
  installGlobal(t, "document", {
    elementFromPoint: () => ({ closest: () => (hit ? row : null) }),
  });
  const point = {
    clientX: 130,
    clientY: 130,
    shiftKey: false,
    currentTarget: { contains: () => true, querySelectorAll: () => [row] },
  } as unknown as DragPoint;
  const drag: Drag = {
    id: "PMON-900001",
    x: 100,
    y: 0,
    pointer: 1,
    active: true,
    intent: null,
    signature: hierarchySignature(store.getSnapshot().data),
  };
  const hover: { current: { id: string; since: number } | null } = {
    current: null,
  };
  const refresh = () =>
    refreshTaskDrag(
      point,
      drag,
      hover,
      () => {},
      () => {},
      { current: true },
    );
  refresh();
  now = 600;
  hit = false;
  refresh();
  assert.equal(hover.current, null);
  now = 700;
  hit = true;
  refresh();
  assert.deepEqual(hover.current, { id: parent, since: 700 });
  now = 1000;
  refresh();
  assert.deepEqual(store.getSnapshot().data.view.expanded, []);
  point.shiftKey = true;
  refresh();
  assert.equal(drag.intent?.delta, 0);
  assert.equal(hover.current, null);
});

test("stationary autoscroll works without any valid drop target and respects viewport and sticky header", (t) => {
  // A failing hit-test proves navigation does not require a valid row/preview.
  installGlobal(t, "document", {
    elementFromPoint: () => {
      throw Error("No valid drop target");
    },
  });
  const scroller = {
    scrollTop: 100,
    getBoundingClientRect: () => ({
      left: 0,
      right: 300,
      top: 100,
      bottom: 500,
    }),
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 40 }) }),
  };
  const point = {
    clientX: 150,
    clientY: 490,
    shiftKey: false,
    currentTarget: { querySelectorAll: () => [scroller] },
  } as unknown as DragPoint;
  assert.equal(scrollTaskDrag(point), true);
  assert.equal(scrollTaskDrag(point), true);
  assert.equal(scroller.scrollTop, 124);
  point.clientY = 165;
  assert.equal(scrollTaskDrag(point), true);
  assert.equal(scroller.scrollTop, 112);
  point.clientY = 300;
  assert.equal(scrollTaskDrag(point), false);
  point.clientX = 301;
  point.clientY = 490;
  assert.equal(scrollTaskDrag(point), false);
  assert.equal(scroller.scrollTop, 112);
});

for (const blocked of ["recovery", "not-ready", "updating"] as const) {
  test(`exact move rejects ${blocked} before flushing drafts`, async (t) => {
    const store = await connectStore(t);
    const before = structuredClone(store.getSnapshot().data);
    if (blocked === "recovery")
      installGlobal(t, "window", {
        location: { href: "https://romdex.example/?recovery=1" },
        sessionStorage: { setItem: () => {}, getItem: () => "1" },
      });
    else
      t.mock.method(workspaceStore, "getSnapshot", () => ({
        ...store.getSnapshot(),
        ready: blocked !== "not-ready",
        updating: blocked === "updating",
      }));
    let flushed = false;
    const unregister = registerDraftEditor({
      dirty: () => true,
      flush: async () => {
        flushed = true;
      },
    });
    t.after(unregister);
    await assert.rejects(
      commitExactTaskMove(before, "PMON-900001", null, null, () => true),
      blocked === "recovery" ? /recovery mode/ : /opening or updating/,
    );
    assert.equal(flushed, false);
    assert.deepEqual(store.getSnapshot().data, before);
  });

  test(`exact move rechecks ${blocked} after draft flush without discarding the draft`, async (t) => {
    const store = await connectStore(t);
    const before = structuredClone(store.getSnapshot().data);
    let stopped = false;
    installGlobal(t, "window", {
      location: { href: "https://romdex.example/" },
      sessionStorage: {
        getItem: () => (blocked === "recovery" && stopped ? "1" : null),
      },
    });
    t.mock.method(workspaceStore, "getSnapshot", () => ({
      ...store.getSnapshot(),
      ready: !(stopped && blocked === "not-ready"),
      updating: stopped && blocked === "updating",
    }));
    const held = gate();
    let dirty = true;
    const unregister = registerDraftEditor({
      dirty: () => dirty,
      flush: async () => {
        await held.promise;
        await store.change((data) => {
          data.commentDrafts.keep = "Preserved draft";
        });
        dirty = false;
        stopped = true;
      },
    });
    t.after(unregister);
    const moving = commitExactTaskMove(
      before,
      "PMON-900001",
      null,
      null,
      () => true,
    );
    await Promise.resolve();
    assert.deepEqual(store.getSnapshot().data, before);
    held.release();
    await assert.rejects(
      moving,
      blocked === "recovery" ? /recovery mode/ : /opening or updating/,
    );
    assert.equal(
      store.getSnapshot().data.commentDrafts.keep,
      "Preserved draft",
    );
    assert.deepEqual(store.getSnapshot().data.operations, before.operations);
    assert.deepEqual(store.getSnapshot().data.order, before.order);
  });
}
