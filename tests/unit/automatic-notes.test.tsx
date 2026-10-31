import assert from "node:assert/strict";
import { test } from "node:test";
import {
  automaticDelivery,
  connectDelivery,
  disconnectDelivery,
  saveDelivery,
} from "../../src/cloud/session";
import { registerDraftEditor } from "../../src/domain/editor-drafts";
import { setTaskComposition } from "../../src/domain/task-editing";
import type { WorkspaceSnapshot } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
test("automatic delivery leaves unscoped dirty drafts alone; manual Save waits for composition then flushes once", async (t) => {
  const data = emptyWorkspace();
  data.cloud = {
    records: {},
    ...data.cloud,
    autoSync: true,
    rollupPending: true,
  };
  const state: WorkspaceSnapshot = {
    ready: true,
    updating: false,
    delivering: false,
    data,
    pendingWrites: 0,
    error: "",
    connection: "",
  };
  let deliveries = 0,
    flushes = 0,
    dirty = true;
  t.mock.method(workspaceStore, "start", async () => {});
  t.mock.method(workspaceStore, "getSnapshot", () => {
    return state;
  });
  t.mock.method(
    workspaceStore,
    "change",
    async (update: (value: typeof data) => void) => {
      update(data);
    },
  );
  t.mock.method(workspaceStore, "flush", async () => {});
  t.mock.method(workspaceStore, "setConnection", () => {});
  t.mock.method(workspaceStore, "deliver", async () => {
    deliveries++;
  });
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    assert.match(String(input), /\/api\/users\/me\?fields=id$/);
    return Response.json({ id: "fictional-owner" });
  });
  const unregister = registerDraftEditor({
    dirty: () => {
      return dirty;
    },
    flush: async () => {
      flushes++;
      dirty = false;
    },
  });
  try {
    await connectDelivery("fictional-session-token");
    await automaticDelivery();
    assert.equal(flushes, 0);
    assert.equal(dirty, true);
    assert.equal(deliveries, 0);
    setTaskComposition("task:notes", true);
    await assert.rejects(saveDelivery(), /compos|typing|finish/i);
    assert.equal(flushes, 0);
    assert.equal(deliveries, 0);
    setTaskComposition("task:notes", false);
    await saveDelivery();
    assert.equal(flushes, 1);
    assert.equal(dirty, false);
    assert.equal(deliveries, 1);
  } finally {
    setTaskComposition("task:notes", false);
    unregister();
    disconnectDelivery();
  }
});
