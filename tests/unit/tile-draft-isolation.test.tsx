import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { mergeIncoming } from "../../src/cloud/incoming-merge";
import {
  captureDraftEditors,
  draftTicketIds,
  flushDraftEditors,
  hasUnscopedDraftEdits,
  registerDraftEditor,
} from "../../src/domain/editor-drafts";
import { editTask } from "../../src/domain/task-actions";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { taskItem } from "../fixtures/task-item";
const task = (id: string): TaskItem =>
  taskItem(id, null, { description: "Keep notes" });
test("Tile Settings declares its known ticket while keeping explicit Apply/Close", () => {
  const source = readFileSync(
    new URL("../../src/components/romdex/tile-settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /registerDraftEditor\(\{\s*ticketIds: \[item\.id\]/);
  assert.match(
    source,
    /Apply or close Tile Settings before switching workspace or updating/,
  );
});
test("dirty scoped tile draft holds only its ticket, preserves capture and still rejects implicit flush", async () => {
  const data = emptyWorkspace();
  data.remote = [task("PMON-1"), task("PMON-2"), task("PMON-3")];
  data.cloud = { records: {}, autoSync: true, accountId: "fixture-owner" };
  editTask(data, "PMON-1", { priority: "High" });
  editTask(data, "PMON-2", { summary: "Independent" });
  let dirty = true;
  const draft = {
    kind: "tile-settings",
    id: "PMON-1",
    baseSummary: "PMON-1",
    baseImage: null,
    name: "Unapplied",
    image: null,
  };
  const unregister = registerDraftEditor({
    ticketIds: [draft.id],
    dirty: () => dirty,
    capture: () => draft,
    flush: async () => {
      throw Error("Apply or close Tile Settings first");
    },
  });
  try {
    assert.equal(hasUnscopedDraftEdits(), false);
    assert.deepEqual([...draftTicketIds()], ["PMON-1"]);
    assert.ok(data.operations[1]);
    assert.deepEqual([...automaticBatch(data)!], [data.operations[1].opId]);
    const before = structuredClone(data.operations);
    mergeIncoming(
      data,
      [
        { ...task("PMON-1"), updated: 2, summary: "Remote" },
        { ...task("PMON-3"), updated: 2, summary: "Fresh unrelated" },
      ],
      draftTicketIds(),
      false,
    );
    assert.ok(data.remote[0]);
    assert.ok(data.remote[2]);
    assert.equal(data.remote[0].summary, "PMON-1");
    assert.equal(data.remote[2].summary, "Fresh unrelated");
    assert.deepEqual(data.operations, before);
    const capture = captureDraftEditors()[0];
    assert.ok(capture);
    assert.equal(capture.name, "Unapplied");
    await assert.rejects(flushDraftEditors(), /Apply or close/);
    dirty = false;
    assert.equal(automaticBatch(data), undefined);
  } finally {
    unregister();
  }
  assert.equal(draftTicketIds().size, 0);
});
