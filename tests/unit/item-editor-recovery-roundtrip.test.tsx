import assert from "node:assert/strict";
import test from "node:test";
import { registerItemDraft } from "../../src/components/romdex/item-editor-support";
import { jsonObject, parseJson } from "../../src/domain/json";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
import { exportWorkspace } from "../../src/domain/workspace-recovery";
import { WorkspaceStore } from "../../src/domain/workspace-store";
void test("repeated exports retain typed originals and unique capture IDs through import/reopen without replay", async () => {
  const data = emptyWorkspace();
  data.remote = [
    {
      id: "PMON-2",
      summary: "Original",
      description: "",
      parentId: null,
      state: "To do",
      priority: "Normal",
      complexity: null,
      type: "Task",
      updated: 1,
      comments: [],
      commentCount: 0,
      "custom:number": 42,
      "custom:boolean": true,
      "custom:unknown": ["retired-id"],
      _custom: [
        {
          id: "number",
          name: "Same label",
          $type: "SimpleIssueCustomField",
          value: 42,
        },
        {
          id: "boolean",
          name: "Same label",
          $type: "SimpleIssueCustomField",
          value: true,
        },
      ],
    },
  ];
  const control = {
    id: "",
    value: "false",
    tagName: "SELECT",
    type: "select-one",
    disabled: false,
    multiple: false,
    selectedOptions: [{ value: "false" }],
    getAttribute: (key: string) => {
      return key === "data-custom-key" ? "custom:boolean" : null;
    },
  };
  const dialog = {
    open: true,
    querySelectorAll: () => {
      return [control];
    },
  } as unknown as HTMLDialogElement;
  const unregister = registerItemDraft(dialog, "PMON-2");
  let exported: string;
  try {
    const first = validateWorkspace(
      jsonObject(parseJson(exportWorkspace(data))).data,
    );
    assert.equal(first.editorRecovery!.length, 1);
    exported = exportWorkspace(first);
  } finally {
    unregister();
  }
  assert.equal(jsonObject(parseJson(exported)).format, "ROMDexWebRecovery/1");
  const imported = validateWorkspace(jsonObject(parseJson(exported)).data);
  assert.equal(imported.editorRecovery!.length, 2);
  assert.equal(
    new Set(
      imported.editorRecovery!.map((entry) => {
        return entry.id;
      }),
    ).size,
    2,
  );
  assert.deepEqual(imported.remote, data.remote);
  assert.deepEqual(
    imported.editorRecovery![0]!.fields,
    imported.editorRecovery![1]!.fields,
  );
  let persisted = JSON.parse(JSON.stringify(imported)),
    revision = 0;
  const persistence = {
    load: () => {
      return Promise.resolve({ data: structuredClone(persisted), revision });
    },
    save: (next: typeof imported, expected: number) => {
      assert.equal(expected, revision);
      persisted = JSON.parse(JSON.stringify(validateWorkspace(next)));
      return Promise.resolve(++revision);
    },
  };
  const store = new WorkspaceStore(persistence);
  await store.start();
  await store.change((next) => {
    next.view.search = "reopen evidence";
  });
  await store.flush();
  const reopened = new WorkspaceStore(persistence);
  await reopened.start();
  assert.deepEqual(
    reopened.getSnapshot().data.editorRecovery,
    imported.editorRecovery,
  );
  assert.deepEqual(reopened.getSnapshot().data.remote, data.remote);
  assert.deepEqual(reopened.getSnapshot().data.operations, []);
});
