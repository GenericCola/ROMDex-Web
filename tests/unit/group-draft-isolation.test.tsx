import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { mergeIncoming } from "../../src/cloud/incoming-merge";
import { stageGroup } from "../../src/domain/bulk-hierarchy";
import {
  draftTicketIds,
  registerDraftEditor,
} from "../../src/domain/editor-drafts";
import { createTask, editTask } from "../../src/domain/task-actions";
import { hierarchySignature } from "../../src/domain/task-drop";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { taskItem as task } from "../fixtures/task-item";
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [
    task("PMON-1"),
    task("PMON-2", "PMON-1"),
    task("PMON-3", "PMON-1"),
    task("PMON-4"),
    task("PMON-5", "PMON-2"),
  ];
  data.cloud = { records: {}, autoSync: true, accountId: "fixture-owner" };
  return data;
};
test("Group draft registers selected members and parent, not a global idle hold", () => {
  const source = readFileSync(
    new URL("../../src/components/romdex/group-draft-row.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /ticketIds: \[\.\.\.draft\.ids, \.\.\.\(draft\.parentId \? \[draft\.parentId\] : \[\]\)\]/,
  );
  assert.match(
    source,
    /Finish or cancel the new parent before switching workspace or updating/,
  );
});
test("group draft allows independent scalar work while holding members, parent and structural delivery", () => {
  const data = fixture();
  editTask(data, "PMON-2", { summary: "Member edit" });
  editTask(data, "PMON-1", { parentId: "PMON-4" });
  editTask(data, "PMON-4", { description: "Independent" });
  assert.ok(data.operations[2]);
  const safe = data.operations[2].opId;
  createTask(data, null, "Unrelated new task");
  const unregister = registerDraftEditor({
    ticketIds: ["PMON-2", "PMON-3", "PMON-1"],
    dirty: () => true,
    flush: async () => {
      throw Error("Finish or cancel");
    },
  });
  try {
    assert.deepEqual([...automaticBatch(data)!], [safe]);
    const before = structuredClone(data);
    mergeIncoming(
      data,
      [{ ...task("PMON-3", "PMON-4"), updated: 2 }],
      draftTicketIds(),
      false,
    );
    assert.deepEqual(data, before);
  } finally {
    unregister();
  }
});
test("independent scalar changes preserve group signature; changed hierarchy and reviewed members still reject atomically", () => {
  const data = fixture(),
    expected = hierarchySignature(data);
  editTask(data, "PMON-4", { description: "Independent" });
  assert.equal(hierarchySignature(data), expected);
  const grouped = structuredClone(data);
  const parent = stageGroup(
    grouped,
    ["PMON-2", "PMON-3"],
    "New group",
    expected,
  );
  assert.ok(
    grouped.operations.some(
      (op) => op.type === "create" && op.issueId === parent,
    ),
  );
  assert.ok(data.remote[2]);
  data.remote[2].parentId = "PMON-4";
  const before = structuredClone(data);
  assert.throws(
    () => stageGroup(data, ["PMON-2", "PMON-3"], "No", expected),
    /hierarchy changed/,
  );
  assert.deepEqual(data, before);
  const reviewed = fixture();
  editTask(reviewed, "PMON-2", { summary: "Held" });
  assert.ok(reviewed.operations[0]);
  reviewed.cloud!.records[reviewed.operations[0].opId] = {
    status: "uncertain",
    message: "Keep receipt",
  };
  const held = structuredClone(reviewed);
  assert.throws(
    () =>
      stageGroup(
        reviewed,
        ["PMON-2", "PMON-3"],
        "No",
        hierarchySignature(reviewed),
      ),
    /review/i,
  );
  assert.deepEqual(reviewed, held);
});
