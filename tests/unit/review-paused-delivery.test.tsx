import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import { reviewDelivery } from "../../src/cloud/review";
import {
  automaticDelivery,
  connectDelivery,
  deliveryPaused,
  disconnectDelivery,
  saveDelivery,
} from "../../src/cloud/session";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
test("reapproving deletion retains suspension; automatic delivery never silently resends", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  const base: TaskItem = {
    id: "PMON-499",
    summary: "Fixture",
    description: "",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    parentId: null,
    updated: 1,
    comments: [],
    commentCount: 0,
  };
  const current = { ...base, state: "Done", updated: 2, commentCount: 1 };
  const data = emptyWorkspace();
  data.remote = [base];
  data.operations = [
    {
      type: "delete",
      opId: "held",
      issueId: base.id,
      ids: [base.id],
      bases: { [base.id]: base },
    },
  ];
  data.cloud = {
    autoSync: true,
    accountId: "fixture",
    records: {
      held: { status: "conflict", message: "Changed", remoteTasks: [current] },
    },
  };
  let revision = 0;
  globalThis.fetch = async (input, options) => {
    assert.equal(
      options?.method,
      "GET",
      "No deletion or other mutation may run",
    );
    requests++;
    const path = new URL(String(input)).pathname;
    if (path.endsWith("users/me")) return Response.json({ id: "fixture" });
    if (path.endsWith("/links"))
      return Response.json([
        { id: "80-1s", direction: "OUTWARD", linkType: { name: "Subtask" } },
      ]);
    if (path.endsWith("/links/80-1s/issues")) return Response.json([]);
    return Response.json({
      id: "2-499",
      idReadable: base.id,
      summary: base.summary,
      description: "",
      updated: 2,
      commentsCount: 1,
      comments: [],
      project: { shortName: "PMON" },
      customFields: [{ name: "State", value: { name: "Done" } }],
    });
  };
  try {
    disconnectDelivery();
    await workspaceStore.switchPersistence({
      load: async () => ({ data, revision }),
      save: async () => ++revision,
    });
    setAuthSession({
      token: "synthetic",
      userId: "fixture",
      projectId: "0-1",
      expiresAt: Date.now() + 60000,
    });
    await connectDelivery("synthetic");
    await assert.rejects(saveDelivery());
    assert.equal(deliveryPaused(), true);
    await reviewDelivery("held", "local");
    assert.equal(
      workspaceStore.getSnapshot().data.cloud?.records.held?.status,
      "ready",
    );
    assert.equal(deliveryPaused(), true);
    const before = requests;
    automaticDelivery();
    assert.equal(requests, before);
    assert.equal(workspaceStore.getSnapshot().data.operations.length, 1);
  } finally {
    disconnectDelivery();
    setAuthSession(null);
    globalThis.fetch = original;
  }
});
