import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIncomingDelta,
  mergeIncoming,
} from "../../src/cloud/incoming-merge";
import { materialize, reconcile } from "../../src/domain/accepted/core.mjs";
import { editTask } from "../../src/domain/task-actions";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const task = (id: string, updated = 1): TaskItem => ({
  id,
  updated,
  parentId: null,
  summary: id,
  description: "",
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  comments: [],
  commentCount: 0,
});
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [task("PMON-1"), task("PMON-2"), task("PMON-3")];
  data.cloud = { autoSync: true, records: {} };
  return data;
};
test("client B refreshes client A's completed edit before B edits: fresh base, no invented merge", () => {
  const data = fixture();
  const incoming = { ...task("PMON-1", 2), priority: "High" };
  assert.equal(mergeIncoming(data, [incoming], new Set()), true);
  assert.equal(data.operations.length, 0);
  editTask(data, "PMON-1", { priority: "Low" });
  const op = data.operations[0];
  assert.equal(op.type, "edit");
  if (op.type !== "edit") throw Error("edit expected");
  assert.equal(op.base.priority, "High");
  assert.equal(op.base.updated, 2);
  assert.deepEqual(reconcile(op.base, op.patch, incoming), {
    patch: { priority: "Low" },
    conflicts: [],
  });
});
test("pending edits keep unseen bases while unrelated tasks refresh; nonoverlap/equal/same-field reconciles correctly", () => {
  for (const remote of [
    { description: "other" },
    { priority: "High" },
    { priority: "Low" },
  ]) {
    const data = fixture();
    editTask(data, "PMON-1", { priority: "High" });
    const before = structuredClone(data.operations);
    mergeIncoming(
      data,
      [
        { ...task("PMON-1", 2), ...remote },
        { ...task("PMON-2", 2), summary: "new" },
      ],
      new Set(),
    );
    assert.deepEqual(data.operations, before);
    assert.equal(data.remote[0].updated, 1);
    assert.equal(data.remote[1].summary, "new");
    const op = data.operations[0];
    if (op.type !== "edit") throw Error("edit expected");
    const result = reconcile(op.base, op.patch, {
      ...task("PMON-1", 2),
      ...remote,
    });
    assert.equal(result.conflicts.length, remote.priority === "Low" ? 1 : 0);
    assert.equal(materialize(data.remote, data.operations)[0].priority, "High");
  }
});
test("held editors and reviewed tickets stay intact while unrelated updates apply; attachments and journals retained", () => {
  const data = fixture();
  editTask(data, "PMON-1", { description: "keep" });
  data.cloud!.records[data.operations[0].opId] = {
    status: "uncertain",
    message: "preserve",
  };
  data.commentDrafts["PMON-2"] = "draft";
  data.order = { "PMON-1": 1 };
  data.attachmentLists = { "PMON-1": [] };
  data.operations.push({
    type: "attachment",
    opId: "file",
    issueId: "PMON-2",
    uploadId: "stored",
    file: { name: "keep.txt", size: 4, mimeType: "text/plain", hash: "abc" },
  });
  const before = structuredClone(data);
  mergeIncoming(
    data,
    data.remote.map((item) => ({ ...item, updated: 3, summary: "new" })),
    new Set(["PMON-2"]),
  );
  assert.deepEqual(data.remote.slice(0, 2), before.remote.slice(0, 2));
  assert.equal(data.remote[2].summary, "new");
  assertIncomingDelta(before, data);
  assert.deepEqual(data.operations, before.operations);
  assert.deepEqual(data.cloud!.records, before.cloud!.records);
});
test("older and equal revisions do not replace newer content; missing tasks and rich comments remain", () => {
  const data = fixture();
  data.remote[0].updated = 4;
  data.remote[0].comments = [
    { id: "c", text: "retained", author: "Fixture", created: 1 },
  ];
  data.remote[0].commentCount = 1;
  assert.equal(
    mergeIncoming(
      data,
      [{ ...task("PMON-1", 4), summary: "different" }],
      new Set(),
    ),
    false,
  );
  assert.equal(mergeIncoming(data, [task("PMON-1", 3)], new Set()), false);
  mergeIncoming(data, [{ ...task("PMON-1", 5), summary: "latest" }], new Set());
  assert.equal(data.remote.length, 3);
  assert.equal(data.remote[0].comments[0].text, "retained");
  assert.equal(data.remote[0].commentCount, 1);
});
test("duplicates, invalid data and cycles fail atomically; missing parent is not accepted", () => {
  const incomingSets = [
    [task("PMON-4"), task("PMON-4")],
    [task("PMON-1", 1.5)],
    [task("PMON-1", Number.MAX_SAFE_INTEGER + 1)],
    [{ ...task("PMON-4"), summary: "" }],
    [
      { ...task("PMON-1", 2), parentId: "PMON-2" },
      { ...task("PMON-2", 2), parentId: "PMON-1" },
    ],
    [{ ...task("PMON-4"), parentId: "PMON-99" }],
  ];
  for (const incoming of incomingSets) {
    const data = fixture(),
      before = structuredClone(data);
    assert.throws(() => mergeIncoming(data, incoming, new Set()));
    assert.deepEqual(data, before);
  }
});
test("structural pending subtree is held without blocking independent remote tickets", () => {
  const data = fixture();
  data.remote[1].parentId = "PMON-1";
  editTask(data, "PMON-1", { parentId: "PMON-3" });
  const before = structuredClone(data);
  const extra = task("PMON-4", 2);
  mergeIncoming(
    data,
    [
      ...data.remote.map((item) => ({
        ...item,
        updated: 2,
        summary: "remote",
      })),
      extra,
    ],
    new Set(),
  );
  assert.deepEqual(data.remote.slice(0, 3), before.remote);
  assert.equal(data.remote[3].id, "PMON-4");
  assert.deepEqual(data.operations, before.operations);
});
test("server status echo updates assigned bookkeeping without creating rollup or outgoing work", () => {
  for (const rollupPending of [undefined, false, true]) {
    const data = fixture();
    if (rollupPending !== undefined) data.cloud!.rollupPending = rollupPending;
    data.cloud!.assigned = {
      "PMON-1": {
        assignedState: "To do",
        lastState: "To do",
        lastUpdated: 1,
        pendingState: null,
      },
    };
    mergeIncoming(data, [{ ...task("PMON-1", 2), state: "Done" }], new Set());
    assert.equal(data.cloud!.assigned!["PMON-1"].assignedState, "Done");
    assert.equal(data.cloud!.rollupPending, rollupPending);
    assert.equal(data.operations.length, 0);
    const before = JSON.stringify(data);
    assert.equal(
      mergeIncoming(data, [{ ...task("PMON-1", 2), state: "Done" }], new Set()),
      false,
    );
    assert.equal(JSON.stringify(data), before);
  }
});
test("store persists only changed incoming data, fences stale results, and keeps user guards", async () => {
  let data = fixture(),
    revision = 0,
    writes = 0;
  const store = new WorkspaceStore({
    load: async () => ({ data, revision }),
    save: async (next: WorkspaceData, expected: number) => {
      assert.equal(expected, revision);
      data = structuredClone(next);
      writes++;
      return ++revision;
    },
  });
  await store.start();
  let fences = 0;
  assert.equal(
    await store.applyIncoming(
      [{ ...task("PMON-2", 2), summary: "fresh" }],
      new Set(),
      () => {
        fences++;
      },
    ),
    true,
  );
  assert.equal(fences, 2);
  assert.equal(writes, 1);
  assert.equal(
    await store.applyIncoming([task("PMON-2", 2)], new Set(), () => {}),
    false,
  );
  assert.equal(writes, 1);
  await assert.rejects(
    store.applyIncoming([task("PMON-2", 3)], new Set(), () => {
      throw Error("stale session");
    }),
    /stale session/,
  );
  assert.equal(writes, 1);
  const before = structuredClone(data),
    invalid = structuredClone(data);
  invalid.operations.push({
    type: "comment",
    opId: "new",
    issueId: "PMON-1",
    text: "unsafe",
    created: 1,
  });
  assert.throws(() => assertIncomingDelta(before, invalid));
});

test("dirty title cannot be unheld by empty comment draft; blocked reparent does not prevent unrelated scalar update", () => {
  const data = fixture();
  data.titleDrafts["PMON-1"] = "unsaved";
  data.commentDrafts["PMON-1"] = "";
  const before = structuredClone(data);
  mergeIncoming(
    data,
    [
      { ...task("PMON-1", 2), summary: "remote" },
      { ...task("PMON-2", 2), parentId: "PMON-1" },
      { ...task("PMON-3", 2), description: "independent" },
    ],
    new Set(),
  );
  assert.deepEqual(data.remote[0], before.remote[0]);
  assert.deepEqual(data.remote[1], before.remote[1]);
  assert.equal(data.remote[2].description, "independent");
});
test("active delivery ticket remains protected while independent incoming change persists", async () => {
  let data = fixture(),
    revision = 0;
  const store = new WorkspaceStore({
    load: async () => ({ data, revision }),
    save: async (next: WorkspaceData) => {
      data = structuredClone(next);
      return ++revision;
    },
  });
  await store.start();
  await store.change((next) => {
    editTask(next, "PMON-1", { priority: "High" });
  });
  let release!: () => void, started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const running = store.deliver(async () => {
    started();
    await held;
  });
  await ready;
  try {
    assert.equal(
      await store.applyIncoming(
        [
          { ...task("PMON-1", 2), priority: "Low" },
          { ...task("PMON-2", 2), summary: "incoming" },
        ],
        new Set(),
        () => {},
      ),
      true,
    );
    assert.equal(store.getSnapshot().delivering, true);
    assert.equal(data.remote[0].priority, "Normal");
    assert.equal(data.remote[1].summary, "incoming");
    assert.throws(() =>
      store.change((next) => {
        next.remote[0].summary = "unsafe";
      }),
    );
  } finally {
    release();
    await running;
  }
});
test("incoming persistence failure propagates without wiping queued data", async () => {
  const data = fixture();
  let fail = false;
  const store = new WorkspaceStore({
    load: async () => ({ data, revision: 0 }),
    save: async () => {
      if (fail) throw Error("Storage unavailable");
      return 1;
    },
  });
  await store.start();
  fail = true;
  await assert.rejects(
    store.applyIncoming([task("PMON-2", 2)], new Set(), () => {}),
    /Storage unavailable/,
  );
  assert.equal(store.getSnapshot().error, "Storage unavailable");
  assert.deepEqual(store.getSnapshot().data.operations, []);
});

test("migration baseline assignment survives unrelated incoming update when assigned map is absent", () => {
  for (const changedState of [false, true]) {
    const data = fixture();
    data.remote[0].state = "Done";
    data.remote[0].assignedState = "Standby";
    data.remote[1].state = "Done";
    data.remote[1].assignedState = "In Development";
    const beforeHeld = structuredClone(data.remote[1]);
    const incoming = {
      ...task("PMON-1", 2),
      state: changedState ? "Needs Testing" : "Done",
      priority: "High",
    };
    mergeIncoming(
      data,
      [incoming, { ...task("PMON-2", 2), state: "Critical / Debugging" }],
      new Set(["PMON-2"]),
    );
    assert.equal(
      data.remote[0].assignedState,
      changedState ? "Needs Testing" : "Standby",
    );
    assert.equal(
      data.cloud!.assigned!["PMON-1"].assignedState,
      changedState ? "Needs Testing" : "Standby",
    );
    assert.equal(data.cloud!.assigned!["PMON-2"], undefined);
    assert.deepEqual(data.remote[1], beforeHeld);
    assert.equal(data.cloud!.rollupPending, undefined);
    assert.deepEqual(data.operations, []);
  }
});
