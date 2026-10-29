import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import {
  flushWorkspaceWork,
  hasWorkspaceWork,
  trackWorkspaceWork,
} from "../../src/domain/workspace-work";
test("local work outlives its dialog and prevents account switch until all writes settle", async () => {
  let finish: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const storage = {
    load: async () => undefined,
    save: async (_data: unknown, revision: number) => revision + 1,
  };
  const store = new WorkspaceStore(storage);
  await store.start();
  let completed = false;
  const work = trackWorkspaceWork(async () => {
    await gate;
    completed = true;
  });
  assert.equal(hasWorkspaceWork(), true);
  // No mounted component or effect owns the registration.
  await assert.rejects(store.switchPersistence(storage), /Finish delivery/);
  let flushed = false;
  const flush = flushWorkspaceWork().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  assert.equal(flushed, false);
  finish?.();
  await work;
  await flush;
  assert.equal(completed, true);
  assert.equal(hasWorkspaceWork(), false);
  await store.switchPersistence(storage);
});
test("failed local work releases registry but rejects concurrent flush for recovery", async () => {
  let fail: ((error: Error) => void) | undefined;
  const gate = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const work = trackWorkspaceWork(() => gate);
  const flush = flushWorkspaceWork();
  fail?.(Error("fixture save failure"));
  await assert.rejects(work, /fixture/);
  await assert.rejects(flush, /fixture/);
  assert.equal(hasWorkspaceWork(), false);
});
