import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDraftEditor } from "../../src/domain/editor-drafts";
import type { JsonObject } from "../../src/domain/json";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
import { exportWorkspace } from "../../src/domain/workspace-recovery";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const tile = (): JsonObject => ({
  kind: "tile-settings",
  id: "PMON-42",
  baseSummary: "Old",
  baseImage: null,
  name: "New",
  image: null,
});
const group = (): JsonObject => ({
  kind: "group-parent",
  ids: ["PMON-42", "PMON-43"],
  parentId: null,
  title: "New parent",
});
const plan = (): JsonObject => ({
  kind: "rdx-plan-editor",
  fields: [{ label: "Value", value: "unsaved" }],
});
test("every capture gets separate identity without replacing task identity or flushing work", async (t) => {
  t.mock.method(
    crypto,
    "randomUUID",
    () => "00000000-0000-4000-8000-000000000000",
  );
  const records = [
    tile(),
    group(),
    plan(),
    { kind: "item-editor", issueId: "PMON-42", fields: [] },
    { id: "npc-draft", kind: "NPCDexDraft", draft: { note: "Kept" } },
  ];
  const before = structuredClone(records);
  let flushes = 0;
  const stop = records.map((record) =>
    registerDraftEditor({
      dirty: () => true,
      capture: () => record,
      flush: async () => {
        flushes++;
      },
    }),
  );
  try {
    const data = emptyWorkspace();
    data.commentDrafts.keep = "Keep draft";
    data.editorRecovery = [
      {
        id: "old",
        captureId: "capture:00000000-0000-4000-8000-000000000000",
        kind: "existing",
      },
    ];
    const first = validateWorkspace(JSON.parse(exportWorkspace(data)).data);
    const second = validateWorkspace(JSON.parse(exportWorkspace(first)).data);
    assert.equal(second.editorRecovery!.length, 11);
    assert.equal(
      new Set(
        second.editorRecovery!.map((record) => record.captureId ?? record.id),
      ).size,
      11,
    );
    assert.deepEqual(second.editorRecovery![0], data.editorRecovery[0]);
    assert.equal(second.editorRecovery![1]!.id, "PMON-42");
    assert.deepEqual(records, before);
    assert.equal(flushes, 0);
    assert.deepEqual(second.operations, []);
    let persisted = JSON.stringify(second),
      revision = 0;
    const persistence = {
      load: async () => ({
        data: validateWorkspace(JSON.parse(persisted)),
        revision,
      }),
      save: async (next: typeof data) => {
        persisted = JSON.stringify(next);
        return ++revision;
      },
    };
    for (const unregister of stop) unregister();
    const store = new WorkspaceStore();
    await store.switchPersistence(persistence);
    await store.flush();
    const reopened = new WorkspaceStore();
    await reopened.switchPersistence(persistence);
    assert.deepEqual(reopened.getSnapshot().data, second);
  } finally {
    for (const unregister of stop) unregister();
  }
});
test("known historical captures normalize identities without inventing unrecorded values", () => {
  const data = emptyWorkspace();
  data.editorRecovery = [tile(), tile(), group(), plan()];
  const original = structuredClone(data.editorRecovery);
  validateWorkspace(data);
  for (const [index, record] of data.editorRecovery.entries()) {
    const { captureId, ...content } = record;
    assert.equal(typeof captureId, "string");
    assert.deepEqual(content, original[index]);
  }
  assert.equal(data.editorRecovery[0]!.id, "PMON-42");
  assert.equal(data.editorRecovery[1]!.id, "PMON-42");
  const normalized = JSON.stringify(data);
  validateWorkspace(data);
  assert.equal(JSON.stringify(data), normalized);
});
test("malformed or unknown no-ID captures and duplicate capture IDs still reject", () => {
  for (const entry of [
    { ...group(), ids: ["OTHER-1"] },
    { ...plan(), fields: [{ label: "x", value: true }] },
    { kind: "unknown" },
    { ...tile(), captureId: 42 },
  ]) {
    const data = emptyWorkspace();
    data.editorRecovery = [entry];
    assert.throws(() => validateWorkspace(data), /recovered editor identity/);
  }
  const data = emptyWorkspace();
  data.editorRecovery = [
    { ...tile(), captureId: "same" },
    { ...tile(), captureId: "same" },
  ];
  assert.throws(() => validateWorkspace(data), /recovered editor identity/);
});

test("legacy item identity avoids existing cross-kind capture IDs", () => {
  const data = emptyWorkspace();
  data.editorRecovery = [
    {
      id: "existing",
      captureId: "item-editor:legacy:PMON-2:1",
      kind: "existing",
    },
    { kind: "item-editor", issueId: "PMON-2", fields: [] },
  ];
  validateWorkspace(data);
  assert.equal(data.editorRecovery[1]!.id, "item-editor:legacy:PMON-2:1:1");
  const normalized = JSON.stringify(data);
  validateWorkspace(data);
  assert.equal(JSON.stringify(data), normalized);
});
