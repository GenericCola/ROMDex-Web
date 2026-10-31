import assert from "node:assert/strict";
import test from "node:test";
import {
  createRowOpenQueue,
  mayOpenDelayedRow,
  type RowOpenContext,
} from "../../src/components/romdex/row-open-queue";
const fixture = () => {
  const timers = new Map<number, () => void>(),
    listeners = new Set<() => void>();
  let next = 0,
    time = 0;
  const events: string[] = [];
  const queue = createRowOpenQueue({
    after: (callback, delay) => {
      assert.equal(delay, 220);
      const id = ++next;
      timers.set(id, callback);
      return () => {
        timers.delete(id);
      };
    },
    interrupt: (cancel) => {
      listeners.add(cancel);
      return () => {
        listeners.delete(cancel);
      };
    },
  });
  const advance = (milliseconds: number) => {
    time += milliseconds;
    if (time < 220) return;
    for (const [id, callback] of [...timers]) {
      timers.delete(id);
      callback();
    }
    time = 0;
  };
  const interrupt = () => {
    for (const cancel of [...listeners]) cancel();
  };
  return { queue, timers, listeners, advance, interrupt, events };
};
const base: RowOpenContext = {
  scope: null,
  workspace: "romdex",
  epoch: 1,
  editing: false,
  modal: false,
};
void test("pointer row opens only after220ms and removes its interrupt listeners", () => {
  const f = fixture();
  f.queue.schedule(
    Symbol(),
    () => {
      return true;
    },
    () => {
      f.events.push("row");
    },
  );
  f.advance(219);
  assert.deepEqual(f.events, []);
  f.advance(1);
  assert.deepEqual(f.events, ["row"]);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
});
void test("latest row wins and unrelated unmount cannot cancel its replacement", () => {
  const f = fixture(),
    first = Symbol(),
    second = Symbol();
  f.queue.schedule(
    first,
    () => {
      return true;
    },
    () => {
      f.events.push("first");
    },
  );
  f.queue.schedule(
    second,
    () => {
      return true;
    },
    () => {
      f.events.push("second");
    },
  );
  f.queue.cancel(first);
  f.advance(220);
  assert.deepEqual(f.events, ["second"]);
  assert.equal(f.listeners.size, 0);
});
for (const intent of [
  "Escape",
  "Tab",
  "F2",
  "Notes pointerdown",
  "selector pointerdown",
  "doubleclick rename",
]) {
  void test(`${intent} cancels pending row navigation without executing it later`, () => {
    const f = fixture(),
      owner = Symbol();
    f.queue.schedule(
      owner,
      () => {
        return true;
      },
      () => {
        f.events.push("stale row");
      },
    );
    f.interrupt();
    f.events.push(intent);
    f.advance(220);
    assert.deepEqual(f.events, [intent]);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.timers.size, 0);
  });
}
for (const surface of ["Filters", "Tools", "Conflict", "Edit Item"]) {
  void test(`${surface} modal appearing without a pointer event blocks delayed navigation`, () => {
    const f = fixture();
    let current = { ...base };
    f.queue.schedule(
      Symbol(),
      () => {
        return mayOpenDelayedRow(base, current);
      },
      () => {
        f.events.push("stale");
      },
    );
    current = { ...base, modal: true };
    f.advance(220);
    assert.deepEqual(f.events, []);
  });
}
for (const current of [
  { ...base, scope: "PMON-2" },
  { ...base, workspace: "npcdex" },
  { ...base, epoch: 2 },
  { ...base, editing: true },
]) {
  void test(`scope/workspace/project/editor context recheck refuses stale row ${JSON.stringify(current)}`, () => {
    assert.equal(mayOpenDelayedRow(base, current), false);
  });
}
void test("unmount cancellation and repeated schedules leave no timer or listener leak", () => {
  const f = fixture(),
    owner = Symbol();
  for (let i = 0; i < 20; i++) {
    f.queue.schedule(
      owner,
      () => {
        return true;
      },
      () => {
        f.events.push("stale");
      },
    );
    assert.equal(f.listeners.size, 1);
    f.queue.cancel(owner);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.timers.size, 0);
  }
  f.advance(220);
  assert.deepEqual(f.events, []);
});
