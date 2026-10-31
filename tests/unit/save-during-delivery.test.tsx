import assert from "node:assert/strict";
import test from "node:test";
import { saveDelivery } from "../../src/cloud/session";
import {
  deliveryMessage,
  saveExplanation,
} from "../../src/components/romdex/header-status";
import { registerDraftEditor } from "../../src/domain/editor-drafts";
import { workspaceStore } from "../../src/domain/workspace-store";

test("manual Save during delivery persists local drafts once without starting another batch", async () => {
  const original = {
    snapshot: workspaceStore.getSnapshot,
    flush: workspaceStore.flush,
    deliver: workspaceStore.deliver,
  };
  const state = structuredClone(original.snapshot());
  state.ready = true;
  state.delivering = true;
  state.connection = "YouTrack data connected";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let drafts = 0,
    persists = 0,
    batches = 0;
  workspaceStore.getSnapshot = () => state;
  workspaceStore.flush = async () => {
    persists++;
  };
  workspaceStore.deliver = async () => {
    batches++;
    throw Error("Duplicate delivery");
  };
  const unregister = registerDraftEditor({
    dirty: () => true,
    flush: async () => {
      drafts++;
      await held;
    },
  });
  try {
    const first = saveDelivery(),
      second = saveDelivery();
    assert.equal(drafts, 1);
    assert.equal(persists, 0);
    release();
    const results = await Promise.all([first, second]);
    assert.equal(batches, 0);
    assert.equal(persists, 2);
    for (const text of results) {
      assert.match(
        text,
        /Saved in this browser.*background delivery continues/,
      );
      assert.equal(
        deliveryMessage(state, { text, connection: state.connection }),
        text,
      );
    }
    assert.match(
      saveExplanation(state, true),
      /Save current drafts in this browser/,
    );
    assert.equal(state.delivering, true);
  } finally {
    release();
    unregister();
    workspaceStore.getSnapshot = original.snapshot;
    workspaceStore.flush = original.flush;
    workspaceStore.deliver = original.deliver;
  }
});

test("guarded draft failure is not reported saved and never starts a second batch", async () => {
  const original = {
    snapshot: workspaceStore.getSnapshot,
    flush: workspaceStore.flush,
    deliver: workspaceStore.deliver,
  };
  const state = structuredClone(original.snapshot());
  state.delivering = true;
  let persists = 0,
    batches = 0;
  workspaceStore.getSnapshot = () => state;
  workspaceStore.flush = async () => {
    persists++;
  };
  workspaceStore.deliver = async () => {
    batches++;
  };
  const unregister = registerDraftEditor({
    dirty: () => true,
    flush: async () => {
      throw Error("Ticket needs review");
    },
  });
  try {
    await assert.rejects(saveDelivery(), /Ticket needs review/);
    assert.equal(persists, 0);
    assert.equal(batches, 0);
    unregister();
    workspaceStore.flush = async () => {
      throw Error("Local persistence failed");
    };
    await assert.rejects(saveDelivery(), /Local persistence failed/);
    assert.equal(batches, 0);
  } finally {
    unregister();
    workspaceStore.getSnapshot = original.snapshot;
    workspaceStore.flush = original.flush;
    workspaceStore.deliver = original.deliver;
  }
});
