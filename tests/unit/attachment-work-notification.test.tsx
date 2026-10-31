import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasDraftEdits,
  registerDraftEditor,
  subscribeDraftEditors,
} from "../../src/domain/editor-drafts";
import {
  hasWorkspaceWork,
  trackWorkspaceWork,
} from "../../src/domain/workspace-work";

test("attachment hook clears its pending ref before notifying the busy-state render", () => {
  const source = readFileSync(
    "src/components/romdex/use-attachment-work.ts",
    "utf8",
  );
  assert.match(source, /pendingRef.current = null;[\s\S]*setBusy\(false\)/);
  assert.equal((source.match(/setBusy\(false\)/g) ?? []).length, 1);
  assert.match(
    source,
    /useLayoutEffect[\s\S]*registerDraftEditor[\s\S]*\[busy\]/,
  );
});

for (const rejected of [false, true])
  test(`settled local work notifies clean draft state, rejection=${rejected}`, async () => {
    let settle!: () => void;
    const gate = new Promise<void>((resolve, reject) => {
      settle = () =>
        rejected ? reject(Error("Synthetic rejected work")) : resolve();
    });
    let pending: Promise<void> | null = trackWorkspaceWork(() => gate);
    const editor = {
      dirty: () => pending !== null,
      flush: async () => {
        await pending;
      },
    };
    let unregister = registerDraftEditor(editor);
    const observed: boolean[] = [];
    const stop = subscribeDraftEditors(() => {
      observed.push(hasDraftEdits());
    });
    const work = pending;
    const done = work.finally(() => {
      pending = null;
      unregister();
      unregister = registerDraftEditor(editor);
    });
    settle();
    if (rejected) await assert.rejects(done, /Synthetic/);
    else await done;
    assert.equal(hasWorkspaceWork(), false);
    assert.equal(hasDraftEdits(), false);
    assert.equal(observed.at(-1), false);
    // A subsequent genuine draft must still prevent the scheduler from sending.
    const dirty = registerDraftEditor({
      dirty: () => true,
      flush: async () => {},
    });
    assert.equal(observed.at(-1), true);
    dirty();
    unregister();
    stop();
  });
