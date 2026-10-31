import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { STATES, rollup, statusOf } from "../../src/domain/accepted/core.mjs";
import type { TaskItem } from "../../src/domain/types";
import { sharedBackend } from "./shared-status-fixture";
const require = createRequire(import.meta.url),
  records = require("../../youtrack-app/status-record.js"),
  rules = require("../../youtrack-app/status-rules.js");
export const root = "PMON-900001",
  child = "PMON-900002";
export const item = (
  id = root,
  state = "To do",
  parentId: string | null = null,
): TaskItem => ({
  id,
  summary: id,
  description: "",
  parentId,
  state,
  assignedState: state,
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const request = (
  backend: ReturnType<typeof sharedBackend>,
  id: string,
  kind: string,
  value: string,
  opId = "fixture-op",
) => ({
  schema: 1,
  opId,
  kind,
  value,
  expected: records.base(backend.call(id, "GET").body),
});
test("YouTrack app metadata GET is read-only and CAS admits only one writer from the same revision", () => {
  const s = sharedBackend([item()]);
  assert.equal(s.call(root, "GET").status, 200);
  assert.equal(s.tasks.get(root)?.metadata, undefined);
  const a = request(s, root, "assign", "Standby", "A"),
    b = request(s, root, "assign", "Done", "B");
  assert.equal(s.call(root, "POST", a).status, 200);
  assert.equal(s.call(root, "POST", b).status, 409);
  assert.equal(
    (s.call(root, "GET").body as { assignedState: string }).assignedState,
    "Standby",
  );
  assert.equal(s.tasks.get(root)?.state, "To do");
});
test("exact request replay is idempotent and changed payloads cannot reuse its ID", () => {
  const s = sharedBackend([item()]),
    body = request(s, root, "assign", "Standby");
  s.call(root, "POST", body);
  const stored = s.tasks.get(root)?.metadata;
  assert.equal(s.call(root, "POST", body).status, 200);
  assert.equal(s.tasks.get(root)?.metadata, stored);
  assert.equal(s.call(root, "POST", { ...body, value: "Done" }).status, 409);
  const later = request(s, root, "assign", "In Development", "later");
  s.call(root, "POST", later);
  assert.equal(s.call(root, "POST", body).status, 409);
});
test("atomic rollups preserve parent assignment and reject stale child calculations", () => {
  const s = sharedBackend([item(), item(child, "Done", root)]);
  s.call(root, "POST", request(s, root, "assign", "Standby", "assign"));
  const body = request(s, root, "rollup", "Done", "rollup");
  assert.equal(s.call(root, "POST", body).status, 200);
  const read = s.call(root, "GET").body as {
    assignedState: string;
    state: string;
  };
  assert.equal(read.assignedState, "Standby");
  assert.equal(read.state, "Done");
  const wrong = request(s, root, "rollup", "To do", "wrong");
  assert.equal(s.call(root, "POST", wrong).status, 409);
  s.tasks.get(child)!.state = "Critical / Debugging";
  const stale = request(s, root, "rollup", "Done", "stale-child");
  assert.equal(s.call(root, "POST", stale).status, 409);
});
test("native State changes are observed as assignments without any GET-side writes", () => {
  const s = sharedBackend([item()]);
  s.call(root, "POST", request(s, root, "assign", "Standby"));
  const old = s.tasks.get(root)!.metadata;
  s.tasks.get(root)!.state = "In Development";
  const read = s.call(root, "GET").body as { assignedState: string };
  assert.equal(read.assignedState, "In Development");
  assert.equal(s.tasks.get(root)!.metadata, old);
});
test("permission, field, body, schema and persisted corruption failures make no writes", () => {
  for (const kind of [
    "read",
    "write",
    "hidden",
    "corrupt",
    "schema",
    "value",
  ]) {
    const s = sharedBackend([item()]),
      body = request(s, root, "assign", "Done");
    const task = s.tasks.get(root)!;
    if (kind === "read") task.readable = false;
    if (kind === "write") task.writable = false;
    if (kind === "hidden") task.hiddenState = true;
    if (kind === "corrupt") task.metadata = "{bad";
    if (kind === "schema") body.schema = 9;
    if (kind === "value") body.value = "Missing State";
    const before = JSON.stringify(task);
    assert.ok(s.call(root, "POST", body).status >= 400);
    assert.equal(JSON.stringify(s.tasks.get(root)), before);
  }
});
test("unreadable, external or cyclic descendants block effective State writes", () => {
  for (const kind of ["unreadable", "external", "cycle"]) {
    const s = sharedBackend([item(), item(child, "Done", root)]);
    const body = request(s, root, "rollup", "Done");
    if (kind === "unreadable") s.tasks.get(child)!.readable = false;
    if (kind === "external") s.tasks.get(child)!.external = true;
    if (kind === "cycle") s.tasks.get(root)!.parentId = child;
    assert.ok(s.call(root, "POST", body).status >= 400);
    assert.equal(s.tasks.get(root)?.state, "To do");
    assert.equal(s.tasks.get(root)?.metadata, undefined);
  }
});
test("a workflow failure cannot leave half a shared rollup committed", () => {
  const s = sharedBackend([item(), item(child, "Done", root)]);
  s.options.workflowReject = true;
  assert.throws(
    () => s.call(root, "POST", request(s, root, "rollup", "Done")),
    /workflow/,
  );
  assert.equal(s.tasks.get(root)?.metadata, undefined);
  assert.equal(s.tasks.get(root)?.state, "To do");
});
test("backend status rules match accepted desktop aliases and all three-child color combinations", () => {
  for (const alias of [
    "Done",
    "Fixed",
    "Complete",
    "Standby",
    "Prompt Ready",
    "Critical / Debugging",
    "Critical",
    "Debugging",
    "Blocked",
    "In Development",
    "Awaiting Testing",
    "Needs Testing",
    "In Progress",
    "Open",
  ])
    assert.equal(rules.statusOf(alias), statusOf(alias));
  assert.deepEqual(rules.states, STATES);
  const colors = Object.keys(STATES) as (keyof typeof STATES)[];
  for (const a of colors)
    for (const b of colors)
      for (const c of colors)
        assert.equal(rules.rollup([a, b, c]), rollup([a, b, c]));
});

test("Awaiting Testing rolls up through the shared handler without losing the parent's own status", () => {
  const s = sharedBackend([item(), item(child, "Awaiting Testing", root)]);
  const body = request(s, root, "rollup", "Needs Testing");
  assert.equal(s.call(root, "POST", body).status, 200);
  const read = s.call(root, "GET").body as {
    state: string;
    assignedState: string;
  };
  assert.equal(read.state, "Needs Testing");
  assert.equal(read.assignedState, "To do");
});
