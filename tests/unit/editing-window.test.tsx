import assert from "node:assert/strict";
import test from "node:test";
import {
  EDITING_IDLE_MS,
  EditingWindow,
} from "../../src/domain/editing-window";
import {
  automaticEditingTicketIds,
  editingTicketIds,
  setTaskComposition,
  setTaskTextEditing,
  subscribeTaskEditing,
  touchTaskTextEditing,
} from "../../src/domain/task-editing";
test("five-minute inactivity restarts on typing and expires each editor independently", () => {
  let now = 0,
    id = 0,
    notices = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock = {
    set: (run: () => void, delay: number) => {
      const key = ++id;
      timers.set(key, { at: now + delay, run });
      return key as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (key: ReturnType<typeof setTimeout>) => {
      timers.delete(key as unknown as number);
    },
  };
  const advance = (milliseconds: number) => {
    now += milliseconds;
    for (const [key, value] of [...timers])
      if (value.at <= now) {
        timers.delete(key);
        value.run();
      }
  };
  const lease = new EditingWindow(() => {
    notices++;
  }, clock);
  assert.equal(EDITING_IDLE_MS, 300000);
  lease.touch("A:notes");
  advance(299999);
  assert.deepEqual(lease.keys(), ["A:notes"]);
  lease.touch("A:notes");
  lease.touch("B:title");
  advance(1);
  assert.deepEqual(lease.keys(), ["A:notes", "B:title"]);
  advance(299998);
  lease.touch("A:notes");
  advance(1);
  assert.deepEqual(lease.keys(), ["A:notes"]);
  advance(299999);
  assert.deepEqual(lease.keys(), []);
  assert.equal(notices, 6);
  lease.touch("A:notes");
  lease.remove("A:notes");
  assert.equal(timers.size, 0);
  advance(300000);
  assert.deepEqual(lease.keys(), []);
});
test("expiry releases only automatic hold; composition and incoming focus remain safe", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let notices = 0;
  const stop = subscribeTaskEditing(() => {
    notices++;
  });
  try {
    setTaskTextEditing("A:notes", true);
    context.mock.timers.tick(299999);
    touchTaskTextEditing("A:notes");
    context.mock.timers.tick(299999);
    assert.deepEqual([...automaticEditingTicketIds()], ["A"]);
    setTaskComposition("A:notes", true);
    context.mock.timers.tick(1);
    assert.deepEqual([...automaticEditingTicketIds()], ["A"]);
    setTaskComposition("A:notes", false);
    context.mock.timers.tick(300000);
    assert.deepEqual([...automaticEditingTicketIds()], []);
    assert.deepEqual([...editingTicketIds()], ["A"]);
    touchTaskTextEditing("A:notes");
    assert.deepEqual([...automaticEditingTicketIds()], ["A"]);
    setTaskTextEditing("A:notes", false);
    touchTaskTextEditing("A:notes");
    assert.deepEqual([...automaticEditingTicketIds()], []);
    setTaskTextEditing("B:title", true);
    assert.deepEqual([...automaticEditingTicketIds()], ["B"]);
    setTaskTextEditing("B:title", false);
    assert.deepEqual([...editingTicketIds()], []);
    assert.ok(notices >= 8);
  } finally {
    setTaskTextEditing("A:notes", false);
    setTaskTextEditing("B:title", false);
    stop();
  }
});
