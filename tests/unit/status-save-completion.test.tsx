import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { saveIndicator } from "../../src/components/romdex/header-status";
import type { TaskItem, WorkspaceSnapshot } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { navigationPort } from "../fixtures/navigation-port";

test("saved child plus failed parent read remains honestly pending; safe next Save completes and lamp turns green", async () => {
  const base: TaskItem = {
    id: "PMON-507",
    summary: "Synthetic child",
    description: "",
    parentId: "PMON-47",
    state: "Needs Testing",
    assignedState: "Needs Testing",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
  const parent = {
    ...base,
    id: "PMON-47",
    summary: "Synthetic parent",
    parentId: null,
    state: "In Progress",
    assignedState: "In Progress",
  };
  const data = emptyWorkspace();
  data.remote = [parent, base];
  data.operations = [
    {
      opId: "status",
      type: "edit",
      issueId: base.id,
      base,
      patch: { assignedState: "Done" },
    },
  ];
  data.cloud = { autoSync: true, accountId: "synthetic-owner", records: {} };
  const { port, remote, sent } = navigationPort([parent, base]);
  const all = port.all;
  let fail = true;
  port.all = async () => {
    if (fail && sent.includes(base.id))
      throw Error("Synthetic parent read failed");
    return all();
  };
  const commit = async (update: (value: typeof data) => void) => {
    update(data);
  };
  const state: WorkspaceSnapshot = {
    data,
    ready: true,
    updating: false,
    delivering: false,
    pendingWrites: 0,
    error: "",
    connection: "Connected",
  };
  await assert.rejects(
    deliverQueue(() => data, commit, port),
    /parent read failed/,
  );
  assert.equal(remote.get(base.id)?.state, "Done");
  assert.equal(data.operations.length, 0);
  assert.equal(data.cloud?.rollupPending, true);
  assert.equal(saveIndicator(state, false).color, "red");
  assert.match(
    saveIndicator(state, false).description,
    /Parent status calculation pending/,
  );
  const archived = Object.values(data.cloud?.records ?? {}).filter(
    (record) => record.status === "confirmed",
  );
  assert.ok(
    archived.some(
      (record) =>
        record.archivedOperation?.type === "edit" &&
        record.archivedOperation.purpose === "rollup",
    ),
  );
  fail = false;
  await deliverQueue(() => data, commit, port);
  assert.equal(remote.get(parent.id)?.state, "Done");
  assert.equal(data.cloud?.rollupPending, false);
  assert.equal(data.operations.length, 0);
  assert.equal(saveIndicator(state, false).color, "green");
  assert.equal(sent.filter((id) => id === base.id).length, 1);
});
