import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyHierarchyRecovery,
  exitHierarchyRecovery,
  previewHierarchyRecovery,
} from "../../src/domain/hierarchy-recovery";
import type { TaskItem } from "../../src/domain/types";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
const scope = { userId: "2-2", projectId: "PMON-project" };
const task = (id: string, parentId: string | null = null): TaskItem => ({
  id,
  parentId,
  summary: id,
  description: "keep",
  state: "Open",
  priority: "Normal",
  complexity: null,
  type: "Epic",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [task("PMON-2", "PMON-300"), task("PMON-300")];
  data.operations = [
    {
      opId: "parent",
      type: "edit",
      issueId: "PMON-2",
      base: task("PMON-2"),
      patch: { parentId: "PMON-300", description: "new notes" },
    },
    {
      opId: "comment",
      type: "comment",
      issueId: "PMON-300",
      text: "keep comment",
      created: 1,
    },
  ];
  data.cloud = { autoSync: true, accountId: "2-2", records: {} };
  data.commentDrafts.keep = "unsaved draft";
  data.order = { "PMON-300": 0, "PMON-2": 1 };
  data.images = { "PMON-2": "data:image/png;base64,aGVsbG8=" };
  return data;
};
const fresh = () => [task("PMON-2"), task("PMON-300")];
test("selected parent repair preserves mixed edit, unrelated queue, draft, order and attachment fields", () => {
  const data = fixture(),
    before = structuredClone(data);
  const preview = previewHierarchyRecovery(data, fresh(), scope);
  assert.equal(preview.items.length, 1);
  applyHierarchyRecovery(data, preview, ["parent"], scope);
  assert.deepEqual(data.operations[0], {
    ...before.operations[0],
    patch: { description: "new notes" },
  });
  assert.equal(data.remote[0]?.parentId, null);
  assert.deepEqual(data.operations[1], before.operations[1]);
  for (const key of [
    "order",
    "commentDrafts",
    "images",
    "titleDrafts",
    "view",
    "cloud",
  ] as const)
    assert.deepEqual(data[key], before[key]);
  assert.equal(data.hierarchyRecovery?.length, 1);
  assert.deepEqual(data.hierarchyRecovery?.[0]?.operations, [
    before.operations[0],
  ]);
  validateWorkspace(data);
});
test("empty selected edit gets local-only backup and record removed, never false server success", () => {
  const data = fixture();
  if (data.operations[0]?.type !== "edit" || !data.cloud)
    throw Error("fixture");
  data.operations[0].patch = { parentId: "PMON-300" };
  data.cloud.records.parent = {
    status: "conflict",
    message: "keep old conflict",
  };
  const before = structuredClone(data),
    preview = previewHierarchyRecovery(data, fresh(), scope);
  applyHierarchyRecovery(data, preview, ["parent"], scope);
  assert.equal(data.operations.length, 1);
  assert.equal(data.cloud.records.parent, undefined);
  assert.deepEqual(data.hierarchyRecovery?.[0]?.records, before.cloud?.records);
  assert.match(
    String(data.hierarchyRecovery?.[0]?.message),
    /cancelled locally/,
  );
  validateWorkspace(data);
});
test("remote-only selection refreshes parent only, not server state or notes", () => {
  const data = fixture();
  data.operations = data.operations.slice(1);
  const server = fresh();
  server[0]!.state = "Changed upstream";
  const preview = previewHierarchyRecovery(data, server, scope);
  assert.equal(preview.items[0]?.id, "remote:PMON-2");
  const before = structuredClone(data.remote[0]);
  applyHierarchyRecovery(data, preview, ["remote:PMON-2"], scope);
  assert.deepEqual(data.remote[0], { ...before, parentId: null });
});
test("uncertain and attempting operations cannot be discarded; unselected operations intact", () => {
  for (const status of ["attempting", "uncertain"] as const) {
    const data = fixture();
    data.cloud!.records.parent = { status, message: "Needs readback" };
    const before = structuredClone(data),
      preview = previewHierarchyRecovery(data, fresh(), scope);
    assert.match(preview.items[0]!.blockedReason!, /[Uu]ncertain/);
    assert.throws(
      () => applyHierarchyRecovery(data, preview, ["parent"], scope),
      /[Uu]ncertain/,
    );
    assert.deepEqual(data, before);
  }
});
test("invalid selections, stale workspace and changed scope fail without changing data", () => {
  for (const change of ["unknown", "duplicate", "scope", "stale"]) {
    const data = fixture(),
      preview = previewHierarchyRecovery(data, fresh(), scope);
    if (change === "stale") data.commentDrafts.new = "newer work";
    const before = structuredClone(data);
    assert.throws(() =>
      applyHierarchyRecovery(
        data,
        preview,
        change === "duplicate"
          ? ["parent", "parent"]
          : [change === "unknown" ? "unknown" : "parent"],
        change === "scope" ? { ...scope, projectId: "other" } : scope,
      ),
    );
    assert.deepEqual(data, before);
  }
  assert.throws(
    () =>
      previewHierarchyRecovery(fixture(), fresh(), {
        ...scope,
        userId: "other",
      }),
    /restricted/,
  );
  const mismatched = fixture();
  mismatched.cloud!.accountId = "other";
  assert.throws(
    () => previewHierarchyRecovery(mismatched, fresh(), scope),
    /restricted/,
  );
});
test("invalid upstream hierarchy fails; missing selected task is blocked", () => {
  for (const server of [
    [task("PMON-2", "PMON-300"), task("PMON-300", "PMON-2")],
    [task("PMON-2", "PMON-999")],
    [task("PMON-2"), task("PMON-2")],
    [task("OTHER-2")],
  ])
    assert.throws(() => previewHierarchyRecovery(fixture(), server, scope));
  const data = fixture(),
    preview = previewHierarchyRecovery(data, [task("PMON-300")], scope);
  assert.match(preview.items[0]!.blockedReason!, /missing/);
  assert.throws(
    () => applyHierarchyRecovery(data, preview, ["parent"], scope),
    /missing/,
  );
});

test("uncertain unrelated journal blocks remote-only refresh; mixed conflict journal preserved", () => {
  const data = fixture();
  data.operations = data.operations.slice(1);
  data.cloud!.records.comment = {
    status: "uncertain",
    message: "Comment outcome unknown",
  };
  let preview = previewHierarchyRecovery(data, fresh(), scope);
  assert.match(preview.items[0]!.blockedReason!, /[Uu]ncertain/);
  assert.throws(
    () => applyHierarchyRecovery(data, preview, ["remote:PMON-2"], scope),
    /[Uu]ncertain/,
  );
  const mixed = fixture();
  mixed.cloud!.records.parent = {
    status: "conflict",
    message: "Parent conflict",
  };
  const before = structuredClone(mixed.cloud);
  preview = previewHierarchyRecovery(mixed, fresh(), scope);
  applyHierarchyRecovery(mixed, preview, ["parent"], scope);
  assert.deepEqual(mixed.cloud, before);
});
test("exit requires a clean fresh hierarchy and no uncertainty; keeps unrelated queue and disables autosync", () => {
  const data = fixture();
  let preview = previewHierarchyRecovery(data, fresh(), scope);
  assert.throws(() => exitHierarchyRecovery(data, preview, scope), /remaining/);
  applyHierarchyRecovery(data, preview, ["parent"], scope);
  preview = previewHierarchyRecovery(data, fresh(), scope);
  const before = structuredClone(data);
  exitHierarchyRecovery(data, preview, scope);
  assert.equal(data.cloud?.autoSync, false);
  assert.deepEqual(data.operations, before.operations);
  assert.deepEqual(data.order, before.order);
  assert.deepEqual(data.commentDrafts, before.commentDrafts);
  assert.equal(data.hierarchyRecovery?.at(-1)?.previousAutoSync, true);
  const uncertain = structuredClone(before);
  uncertain.cloud!.records.comment = {
    status: "uncertain",
    message: "Unknown",
  };
  assert.throws(
    () =>
      exitHierarchyRecovery(
        uncertain,
        previewHierarchyRecovery(uncertain, fresh(), scope),
        scope,
      ),
    /[Uu]ncertain/,
  );
  const missing = structuredClone(before);
  assert.throws(
    () =>
      exitHierarchyRecovery(
        missing,
        previewHierarchyRecovery(missing, [task("PMON-300")], scope),
        scope,
      ),
    /remaining/,
  );
});
test("partial selected repair leaving a cycle is rejected atomically", () => {
  const data = fixture();
  data.operations[0] = {
    opId: "parent",
    type: "edit",
    issueId: "PMON-2",
    base: task("PMON-2"),
    patch: { parentId: null },
  };
  data.operations.push({
    opId: "other-parent",
    type: "edit",
    issueId: "PMON-300",
    base: task("PMON-300"),
    patch: { parentId: "PMON-2" },
  });
  const server = [task("PMON-2", "PMON-300"), task("PMON-300")];
  const preview = previewHierarchyRecovery(data, server, scope),
    before = structuredClone(data);
  assert.throws(
    () => applyHierarchyRecovery(data, preview, ["parent"], scope),
    /cycle/,
  );
  assert.deepEqual(data, before);
});

test("zero hierarchy differences still identify the uncertain issue and operation", () => {
  const data = fixture();
  data.remote = fresh();
  data.operations = data.operations.slice(1);
  data.cloud!.records.comment = { status: "uncertain", message: "Unknown comment outcome" };
  const preview = previewHierarchyRecovery(data, fresh(), scope);
  assert.equal(preview.items.length, 0);
  assert.match(preview.blockedReason ?? "", /PMON-300.*operation comment/);
  assert.throws(() => exitHierarchyRecovery(data, preview, scope), /PMON-300.*operation comment/);
});
