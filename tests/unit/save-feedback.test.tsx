import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import SaveFeedback from "../../src/components/romdex/save-feedback";
import type { WorkspaceSnapshot } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
void test("ordinary attempts show syncing; settled review stays concise and global errors stay visible", () => {
  const state: WorkspaceSnapshot = {
    data: emptyWorkspace(),
    ready: true,
    updating: false,
    delivering: true,
    pendingWrites: 0,
    error: "",
    connection: "raw delivery reason",
  };
  state.data.operations = [
    {
      opId: "held",
      type: "comment",
      issueId: "PMON-1",
      text: "preserved",
      created: 1,
    },
  ];
  state.data.cloud = {
    accountId: "synthetic-owner",
    autoSync: true,
    records: { held: { status: "attempting", message: "waiting" } },
  };
  const render = () =>
    renderToStaticMarkup(
      <SaveFeedback state={state} review={() => undefined} />,
    );
  assert.match(render(), /Syncing changes/);
  assert.doesNotMatch(render(), /Review saved changes/);
  state.delivering = false;
  state.data.cloud.records.held!.status = "uncertain";
  assert.match(render(), /Other unrelated changes can sync/);
  assert.doesNotMatch(render(), /raw delivery reason/);
  state.error = "Storage failed";
  state.connection = "Save stopped: Storage failed";
  assert.match(render(), /Save stopped: Storage failed/);
  assert.doesNotMatch(render(), /Other unrelated changes can sync/);
});
