import assert from "node:assert/strict";
import { test } from "node:test";
import type { JsonObject } from "../../src/domain/json";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
import { exportWorkspace } from "../../src/domain/workspace-recovery";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const legacy = (): JsonObject => ({
  kind: "item-editor",
  issueId: "PMON-42",
  fields: [
    { id: "edit-summary", value: "Unsaved title" },
    { id: "", value: "on" },
  ],
});
test("legacy no-ID item editor evidence imports and reopens without changing its content", async () => {
  const data = emptyWorkspace();
  data.commentDrafts.keep = "Unrelated draft";
  data.editorRecovery = [
    legacy(),
    legacy(),
    {
      id: "item-editor:legacy:PMON-42:0",
      kind: "npcdex",
      value: "Existing evidence",
    },
  ];
  const before = structuredClone(data.editorRecovery);
  const parsed = validateWorkspace(JSON.parse(JSON.stringify(data)));
  assert.equal(new Set(parsed.editorRecovery!.map((item) => item.id)).size, 3);
  for (let i = 0; i < 2; i++) {
    const { id, ...content } = parsed.editorRecovery![i]!;
    assert.equal(typeof id, "string");
    assert.deepEqual(content, before[i]);
  }
  assert.deepEqual(parsed.editorRecovery![2], before[2]);
  const exported = JSON.parse(exportWorkspace(parsed));
  let stored = JSON.stringify(validateWorkspace(exported.data));
  let revision = 0;
  const persistence = {
    load: async () => ({
      data: validateWorkspace(JSON.parse(stored)),
      revision,
    }),
    save: async (next: typeof data) => {
      stored = JSON.stringify(next);
      return ++revision;
    },
  };
  const store = new WorkspaceStore();
  await store.switchPersistence(persistence);
  await store.flush();
  const reopened = new WorkspaceStore();
  await reopened.switchPersistence(persistence);
  assert.deepEqual(reopened.getSnapshot().data, parsed);
});
test("legacy identity compatibility rejects other missing identities and malformed item evidence", () => {
  for (const entry of [
    { ...legacy(), kind: "npcdex" },
    { ...legacy(), issueId: "OTHER-42" },
    { ...legacy(), fields: [{ id: "", value: true }] },
    { ...legacy(), fields: [{ id: "", value: "x", command: "send" }] },
    { ...legacy(), id: null },
  ]) {
    const data = emptyWorkspace();
    data.editorRecovery = [entry];
    assert.throws(() => validateWorkspace(data), /recovered editor identity/);
  }
  const data = emptyWorkspace();
  data.editorRecovery = [
    { ...legacy(), id: "same" },
    { ...legacy(), id: "same" },
  ];
  assert.throws(() => validateWorkspace(data), /recovered editor identity/);
});
