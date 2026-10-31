import assert from "node:assert/strict";
import test from "node:test";
import { harness, settle } from "../fixtures/outgoing-scheduler";
void test("committed changes debounce for 750ms; identical notifications do not postpone", async () => {
  let calls = 0;
  const h = harness(() => {
    calls++;
    h.change(null);
    return undefined;
  });
  h.change("edit A");
  h.tick(749);
  await settle();
  assert.equal(calls, 0);
  h.change("edit A");
  h.tick(1);
  await settle();
  assert.equal(calls, 1);
  assert.equal(h.count(), 0);
  h.stop();
});
void test("a new edit restarts debounce rather than delivering an older snapshot", async () => {
  let calls = 0;
  const h = harness(() => {
    calls++;
    h.change(null);
    return undefined;
  });
  h.change("A");
  h.tick(500);
  h.change("B");
  h.tick(749);
  await settle();
  assert.equal(calls, 0);
  h.tick(1);
  await settle();
  assert.equal(calls, 1);
  h.stop();
});
void test("OFF or uncommitted drafts cancel eligibility until a later committed change", async () => {
  let calls = 0;
  const h = harness(() => {
    calls++;
    h.change(null);
    return undefined;
  });
  h.change("A");
  h.tick(500);
  h.change(null);
  h.tick(5000);
  await settle();
  assert.equal(calls, 0);
  assert.equal(h.count(), 0);
  h.change("A");
  h.tick(750);
  await settle();
  assert.equal(calls, 1);
  h.stop();
});
void test("in-flight delivery never overlaps; newer committed work receives another debounce", async () => {
  let finish!: () => void,
    calls = 0;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const h = harness(() => {
    calls++;
    if (calls === 1) return pending;
    h.change(null);
    return undefined;
  });
  h.change("A");
  h.tick(750);
  await settle();
  h.change("B");
  h.tick(9000);
  await settle();
  assert.equal(calls, 1);
  finish();
  await settle();
  assert.equal(h.count(), 1);
  h.tick(749);
  await settle();
  assert.equal(calls, 1);
  h.tick(1);
  await settle();
  assert.equal(calls, 2);
  h.stop();
});
void test("stop cancels timers and unsubscribes without dispatch", async () => {
  let calls = 0;
  const h = harness(() => {
    calls++;
  });
  h.change("A");
  h.stop();
  h.tick(5000);
  h.change("B");
  await settle();
  assert.equal(calls, 0);
  assert.equal(h.count(), 0);
  assert.equal(h.stopped(), true);
});
void test("rejected delivery stays paused and never silently retries", async () => {
  let calls = 0;
  const h = harness(() => {
    calls++;
    return Promise.reject(Error("uncertain"));
  });
  h.change("A");
  h.tick(750);
  await settle();
  h.change("B");
  h.tick(9000);
  await settle();
  assert.equal(calls, 1);
  assert.equal(h.count(), 0);
  h.stop();
});
void test("OFF and stop between timer firing and dispatch microtask prevent run", async () => {
  for (const stop of [false, true]) {
    let calls = 0;
    const h = harness(() => {
      calls++;
    });
    h.change("A");
    h.tick(750);
    if (stop) h.stop();
    else h.change(null);
    await settle();
    assert.equal(calls, 0);
    h.stop();
  }
});
