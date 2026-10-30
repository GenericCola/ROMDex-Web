import assert from "node:assert/strict";
import { test } from "node:test";
import { itemName, selectorSubtitle, taskTier } from "../../src/domain/task-presentation";

test("desktop labels strip only the accepted Epic display prefix, never task data", () => {
  const item = { summary: "[Epic] Core Features" };
  assert.equal(itemName(item), "Core Features");
  assert.equal(item.summary, "[Epic] Core Features");
  assert.equal(itemName({ summary: "[Story] Keep my title" }), "[Story] Keep my title");
  assert.equal(itemName(undefined), "Untitled");
});
test("selector subtitles retain desktop hierarchy and child-count language", () => {
  assert.equal(selectorSubtitle(0, 2), "Epic · 2 Sagas");
  assert.equal(selectorSubtitle(1, 1), "Saga · 1 Story");
  assert.equal(selectorSubtitle(1, 2), "Saga · 2 Stories");
  assert.equal(selectorSubtitle(2, 0), "Story · 0 Verses");
  assert.equal(selectorSubtitle(3, 4), "Verse · 4 Tasks");
  assert.equal(taskTier(7), "Task");
});

import { applyTileSettings } from "../../src/domain/tile-settings";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import type { TaskItem } from "../../src/domain/types";
const fixture = (): TaskItem => ({ id: "PMON-1", parentId: null, summary: "[Epic] Original", description: "", state: "To do", priority: "Normal", complexity: null, type: "Epic", updated: 1, comments: [], commentCount: 0 });
test("tile settings retain native Epic prefix and write only selected image and rename", () => {
  const data = emptyWorkspace(); data.remote = [fixture()]; data.images = { other: "keep" };
  applyTileSettings(data, { id: "PMON-1", baseSummary: "[Epic] Original", baseImage: null, name: "Renamed", image: "data:image/png;base64,AA==" });
  assert.equal(data.operations.length, 1);
  assert.equal(data.operations[0]?.type, "edit");
  if (data.operations[0]?.type === "edit") assert.equal(data.operations[0].patch.summary, "[Epic] Renamed");
  assert.equal(data.remote[0]?.summary, "[Epic] Original");
  assert.equal(data.images.other, "keep");
  assert.equal(data.images["PMON-1"], "data:image/png;base64,AA==");
});
test("stale or empty tile edits cannot partly mutate images or queue", () => {
  const data = emptyWorkspace(); data.remote = [fixture()];
  const draft = { id: "PMON-1", baseSummary: "[Epic] Original", baseImage: null, name: "", image: "data:image/png;base64,AA==" };
  assert.throws(() => applyTileSettings(data, draft), /Enter an item name/);
  assert.throws(() => applyTileSettings(data, { ...draft, baseSummary: "old", name: "New" }), /changed/);
  assert.equal(data.operations.length, 0);
  assert.equal(data.images, undefined);
});

import { indexTree } from "../../src/domain/accepted/core.mjs";
import { selectorExpansion } from "../../src/domain/task-presentation";
test("desktop disclosure opens one ancestor path and collapses descendants", () => {
  const root = fixture();
  const child = { ...fixture(), id: "PMON-2", parentId: root.id };
  const leaf = { ...fixture(), id: "PMON-3", parentId: child.id };
  const tree = indexTree([root, child, leaf], {});
  assert.deepEqual(selectorExpansion(tree, child, false), [root.id, child.id]);
  assert.deepEqual(selectorExpansion(tree, child, true), [root.id]);
  assert.deepEqual(selectorExpansion(tree, root, true), []);
});
