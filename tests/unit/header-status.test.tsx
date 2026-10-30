import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  saveExplanation,
  syncControl,
} from "../../src/components/romdex/header-status";
import type { WorkspaceSnapshot } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
test("disconnected Auto-Sync opens details, never toggles saved preference or enables delivery", () => {
  for (const enabled of [false, true]) {
    const control = syncControl(false, enabled);
    assert.equal(control.role, "button");
    assert.equal(control.checked, undefined);
    assert.match(control.description, /No changes are sent/);
  }
  assert.equal(syncControl(true, false).checked, false);
  assert.equal(syncControl(true, true).checked, true);
  const source = readFileSync("src/components/romdex/header.tsx", "utf8");
  assert.match(source, /onClick=\{sync.connected \? toggleSync : connect\}/);
  assert.doesNotMatch(source, /connectDelivery/);
});
test("Save reason distinguishes local errors, writes, drafts, queue, rollups and clean state", () => {
  const state: WorkspaceSnapshot = {
    ready: true,
    updating: false,
    delivering: false,
    data: emptyWorkspace(),
    pendingWrites: 0,
    error: "",
    connection: "Not connected",
  };
  assert.match(saveExplanation(state, false), /No pending/);
  assert.match(saveExplanation(state, true), /Unsaved editor drafts/);
  state.data.operations.push({
    opId: "fixture",
    type: "comment",
    issueId: "PMON-1",
    text: "fixture",
    created: 1,
  });
  state.data.cloud = { ...state.data.cloud, rollupPending: true };
  assert.match(
    saveExplanation(state, true),
    /drafts; 1 queued change not yet confirmed in YouTrack; Parent status/,
  );
  state.pendingWrites = 1;
  assert.match(saveExplanation(state, true), /Saving changes in this browser/);
  state.error = "Storage unavailable";
  assert.match(
    saveExplanation(state, true),
    /Local save needs attention: Storage unavailable/,
  );
});
