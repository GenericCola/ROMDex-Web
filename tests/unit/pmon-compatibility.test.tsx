import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesCreation } from "../../src/cloud/creation";
import { readRollupTree } from "../../src/cloud/rollup-tree";
import type { DeliveryPort } from "../../src/cloud/types";
import {
  indexTree,
  rollup,
  STATES,
  statusOf,
  youTrackState,
} from "../../src/domain/accepted/core.mjs";
import type { LampColor, TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { issueBody } from "../../src/youtrack/issue-body";
const root = "PMON-900001",
  child = "PMON-900002",
  other = "PMON-900003",
  grand = "PMON-900004";
const item = (
  id: string,
  state: string,
  parentId: string | null = null,
): TaskItem => ({
  id,
  summary: id,
  description: "",
  state,
  assignedState: state,
  parentId,
  priority: "Major",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
});

test("PMON testing aliases use the existing State and every mixed parent displays amber", () => {
  assert.equal(youTrackState("Awaiting Testing"), "Needs Testing");
  assert.equal(youTrackState("Needs Testing"), "Needs Testing");
  assert.equal(youTrackState("In Development"), "In Development");
  assert.equal(statusOf("Needs Testing"), "amber");
  const colors = Object.keys(STATES) as LampColor[];
  for (const a of colors)
    for (const b of colors)
      for (const c of colors)
        if ([a, b, c].includes("amber"))
          assert.equal(rollup([a, b, c]), "amber");
  const tree = indexTree([
    item(grand, "To do"),
    item(root, "To do", grand),
    item(child, "Needs Testing", root),
    item(other, "Critical / Debugging", root),
  ]);
  assert.equal(tree.colors.get(root), "amber");
  assert.equal(tree.colors.get(grand), "amber");
});

test("native testing payloads and creation readback map the label without changing other properties", () => {
  const fields = [{ id: "1-1", name: "State", $type: "StateIssueCustomField" }];
  assert.deepEqual(issueBody({ state: "Awaiting Testing" }, fields), {
    customFields: [
      {
        id: "1-1",
        name: "State",
        $type: "StateIssueCustomField",
        value: { name: "Needs Testing" },
      },
    ],
  });
  const desired = item("local-fixture", "Awaiting Testing"),
    remote = {
      ...desired,
      id: child,
      state: "Needs Testing",
      assignedState: "Needs Testing",
    };
  assert.equal(matchesCreation(desired, remote), true);
  assert.equal(
    matchesCreation(desired, { ...remote, state: "In Development" }),
    false,
  );
});

test("a native Needs Testing leaf never schedules a spurious write and legacy labels converge once", async () => {
  const data = emptyWorkspace(),
    native = item(child, "Needs Testing");
  data.remote = [native];
  const port = {
    accountId: "fixture",
    all: async () => [native],
    children: async () => [],
  } as unknown as DeliveryPort;
  assert.equal((await readRollupTree(data, port)).next, undefined);
  data.remote = [{ ...native, assignedState: "Awaiting Testing" }];
  data.cloud = {
    ...data.cloud,
    assigned: {
      [child]: {
        assignedState: "Awaiting Testing",
        lastState: "Needs Testing",
        lastUpdated: 1,
        pendingState: null,
      },
    },
    accountId: "fixture",
    autoSync: false,
    records: {},
  };
  const tree = await readRollupTree(data, port);
  assert.equal(tree.desired(tree.items[0]!), "Needs Testing");
  assert.equal(tree.next, undefined);
});
