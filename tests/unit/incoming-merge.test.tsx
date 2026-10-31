import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIncomingDelta,
  mergeIncoming,
} from "../../src/cloud/incoming-merge";
import {
  availabilityFingerprint,
  deferredStatusChanged,
} from "../../src/cloud/unavailable-tasks";
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
  data.cloud = { autoSync: true, records: {}, accountId: "synthetic-owner" };
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
test("older and equal revisions preserve newer content; complete-snapshot omissions are archived", () => {
  const data = fixture();
  data.remote[0].updated = 4;
  data.remote[0].comments = [
    { id: "c", text: "retained", author: "Fixture", created: 1 },
  ];
  data.remote[0].commentCount = 1;
  assert.equal(
    mergeIncoming(
      data,
      [
        { ...task("PMON-1", 4), summary: "different" },
        task("PMON-2"),
        task("PMON-3"),
      ],
      new Set(),
    ),
    false,
  );
  assert.equal(
    mergeIncoming(
      data,
      [task("PMON-1", 3), task("PMON-2"), task("PMON-3")],
      new Set(),
    ),
    false,
  );
  mergeIncoming(data, [{ ...task("PMON-1", 5), summary: "latest" }], new Set());
  assert.equal(data.remote.length, 1);
  assert.deepEqual(data.cloud?.unavailable?.missingIds, ["PMON-2", "PMON-3"]);
  assert.equal(data.remote[0].comments[0].text, "retained");
  assert.equal(data.remote[0].commentCount, 1);
});
test("duplicates, invalid data and cycles fail atomically", () => {
  const incomingSets = [
    [task("PMON-4"), task("PMON-4")],
    [task("PMON-1", 1.5)],
    [task("PMON-1", Number.MAX_SAFE_INTEGER + 1)],
    [{ ...task("PMON-4"), summary: "" }],
    [
      { ...task("PMON-1", 2), parentId: "PMON-2" },
      { ...task("PMON-2", 2), parentId: "PMON-1" },
    ],
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
test("new shared status schedules derived status work without creating outgoing operations", () => {
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
    assert.equal(data.cloud!.rollupPending, true);
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
    assert.equal(data.cloud!.rollupPending, true);
    assert.deepEqual(data.operations, []);
  }
});

test("complete snapshot retires clean missing children without deleting their recovery copy; reappearance returns them", () => {
  const data = fixture();
  data.remote[1].parentId = "PMON-1";
  data.remote[1].description = "Keep archived notes";
  const before = structuredClone(data.remote[1]);
  const full = [task("PMON-1", 2), task("PMON-3", 2)];
  mergeIncoming(data, full, new Set());
  assert.deepEqual(
    data.remote.map((item) => item.id),
    ["PMON-1", "PMON-3"],
  );
  assert.deepEqual(data.cloud?.unavailable?.tasks, [before]);
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, []);
  assert.equal(data.operations.length, 0);
  mergeIncoming(data, full, new Set());
  assert.deepEqual(data.cloud?.unavailable?.tasks, [before]);
  mergeIncoming(data, [...full, { ...before, updated: 3 }], new Set());
  assert.ok(data.remote.some((item) => item.id === "PMON-2"));
  assert.equal(data.cloud?.unavailable, undefined);
});
test("omitted pending task and its ancestors remain recoverable; unrelated fresh tasks still apply", () => {
  const data = fixture();
  data.remote[1].parentId = "PMON-1";
  editTask(data, "PMON-2", { summary: "Keep pending edit" });
  data.commentDrafts["PMON-2"] = "Keep draft";
  data.attachmentLists = { "PMON-2": [] };
  const before = structuredClone(data);
  mergeIncoming(
    data,
    [{ ...task("PMON-3", 2), summary: "Fresh unrelated" }],
    new Set(),
  );
  assert.ok(data.remote.some((item) => item.id === "PMON-1"));
  assert.equal(
    data.remote.find((item) => item.id === "PMON-3")?.summary,
    "Fresh unrelated",
  );
  assert.deepEqual(data.operations, before.operations);
  assert.deepEqual(data.commentDrafts, before.commentDrafts);
  assert.deepEqual(data.attachmentLists, before.attachmentLists);
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, ["PMON-2"]);
  assert.equal(
    materialize(data.remote, data.operations).find(
      (item) => item.id === "PMON-2",
    )?.summary,
    "Keep pending edit",
  );
});
test("fresh visible orphan preserves its actual parent ID and is not globally rejected", () => {
  const data = fixture();
  mergeIncoming(
    data,
    [{ ...task("PMON-2", 2), parentId: "PMON-99" }],
    new Set(),
  );
  assert.equal(data.remote.length, 1);
  assert.equal(data.remote[0].parentId, "PMON-99");
  assert.equal(data.operations.length, 0);
});

test("omitted local status intent remains held even without an operation", () => {
  const data = fixture();
  data.cloud!.assigned = {
    "PMON-2": {
      assignedState: "Done",
      lastState: "To do",
      lastUpdated: 1,
      pendingState: null,
    },
  };
  mergeIncoming(data, [task("PMON-1", 2), task("PMON-3", 2)], new Set());
  assert.ok(data.remote.some((item) => item.id === "PMON-2"));
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, ["PMON-2"]);
  assert.equal(data.cloud?.assigned?.["PMON-2"].assignedState, "Done");
  const before = JSON.stringify(data);
  assert.equal(
    mergeIncoming(data, [task("PMON-1", 2), task("PMON-3", 2)], new Set()),
    false,
  );
  assert.equal(JSON.stringify(data), before);
});

test("single-ticket refresh never retires unrelated rows or their archive", () => {
  const data = fixture();
  const omitted = task("PMON-8");
  data.cloud!.unavailable = {
    accountId: "synthetic-owner",
    project: "PMON",
    tasks: [omitted],
    missingIds: [omitted.id],
    blockedIds: [],
    fingerprint: "prior",
  };
  const archive = structuredClone(data.cloud!.unavailable);
  mergeIncoming(
    data,
    [{ ...task("PMON-1", 2), summary: "Single fresh" }],
    new Set(),
    false,
  );
  assert.deepEqual(
    data.remote.map((item) => item.id),
    ["PMON-1", "PMON-2", "PMON-3"],
  );
  assert.equal(data.remote[0].summary, "Single fresh");
  assert.deepEqual(data.cloud!.unavailable, archive);
});

test("fresh child-link deferral survives full snapshots and relevant revisions remain detectable", () => {
  const data = fixture(),
    missing = ["PMON-8"],
    blocked = ["PMON-1"];
  const fingerprint = availabilityFingerprint(data, missing, blocked);
  data.cloud!.unavailable = {
    accountId: "synthetic-owner",
    project: "PMON",
    tasks: [],
    missingIds: missing,
    linkedMissingIds: missing,
    blockedIds: blocked,
    fingerprint,
  };
  assert.equal(
    mergeIncoming(data, structuredClone(data.remote), new Set()),
    false,
  );
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, blocked);
  assert.deepEqual(data.cloud?.unavailable?.linkedMissingIds, missing);
  assert.equal(deferredStatusChanged(data), false);
  mergeIncoming(
    data,
    [
      { ...task("PMON-1", 2), summary: "Relevant parent changed" },
      task("PMON-2"),
      task("PMON-3"),
    ],
    new Set(),
  );
  assert.equal(data.cloud?.unavailable?.fingerprint, fingerprint);
  assert.equal(deferredStatusChanged(data), true);
  mergeIncoming(
    data,
    [
      ...structuredClone(data.remote),
      { ...task("PMON-8", 2), parentId: "PMON-1" },
    ],
    new Set(),
  );
  assert.equal(data.cloud?.unavailable, undefined);
});
test("legacy cache-only deferral does not preserve obsolete fresh-parent blocks", () => {
  const data = fixture();
  data.cloud!.unavailable = {
    accountId: "synthetic-owner",
    project: "PMON",
    tasks: [task("PMON-8")],
    missingIds: ["PMON-8"],
    blockedIds: ["PMON-1"],
    fingerprint: "old",
  };
  mergeIncoming(data, structuredClone(data.remote), new Set());
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, []);
  assert.deepEqual(data.cloud?.unavailable?.tasks, [task("PMON-8")]);
  assert.equal(deferredStatusChanged(data), false);
});

test("omitted inherited Done parent with assigned Standby is not unsent local status intent", () => {
  const data = fixture();
  data.remote[1].parentId = "PMON-1";
  data.remote[1].state = "Done";
  data.remote[1].assignedState = "Complete";
  data.remote[0].state = "Done";
  data.remote[0].assignedState = "Standby";
  data.cloud!.assigned = {
    "PMON-1": {
      assignedState: "Standby",
      lastState: "Done",
      lastUpdated: 1,
      pendingState: null,
    },
  };
  mergeIncoming(data, [task("PMON-3", 2)], new Set());
  assert.deepEqual(
    data.remote.map((item) => item.id),
    ["PMON-3"],
  );
  assert.deepEqual(data.cloud?.unavailable?.blockedIds, []);
  assert.ok(
    data.cloud?.unavailable?.tasks.some((item) => item.id === "PMON-1"),
  );
  data.cloud!.rollupPending = false;
  for (let i = 0; i < 3; i++) {
    mergeIncoming(data, [task("PMON-3", 2)], new Set());
    assert.deepEqual(data.cloud?.unavailable?.blockedIds, []);
    assert.equal(data.cloud?.rollupPending, false);
    assert.deepEqual(
      data.remote.map((item) => item.id),
      ["PMON-3"],
    );
  }
});

test("derived status debt follows complete visible tree changes, not notes, repeats, row order or partial reads", () => {
  for (const change of ["state", "membership", "parent"]) {
    const data = fixture();
    const fresh = structuredClone(data.remote);
    if (change === "state") {
      fresh[1].state = "Done";
      fresh[1].updated = 2;
    }
    if (change === "membership") fresh.pop();
    if (change === "parent") {
      fresh[1].parentId = "PMON-1";
      fresh[1].updated = 2;
    }
    mergeIncoming(data, fresh, new Set());
    assert.equal(data.cloud?.rollupPending, true, change);
    data.cloud!.rollupPending = false;
    mergeIncoming(data, [...fresh].reverse(), new Set());
    assert.equal(data.cloud?.rollupPending, false, `${change} repeated`);
    assert.deepEqual(data.operations, []);
  }
  const notes = fixture();
  mergeIncoming(
    notes,
    notes.remote.map((item) => ({
      ...item,
      updated: 2,
      description: "New notes",
    })),
    new Set(),
  );
  assert.equal(notes.cloud?.rollupPending, undefined);
  const partial = fixture();
  mergeIncoming(
    partial,
    [{ ...task("PMON-2", 2), state: "Done" }],
    new Set(),
    false,
  );
  assert.equal(partial.cloud?.rollupPending, undefined);
  const held = fixture();
  mergeIncoming(
    held,
    held.remote.map((item) => ({ ...item, updated: 2, state: "Done" })),
    new Set(held.remote.map((item) => item.id)),
  );
  assert.equal(held.cloud?.rollupPending, undefined);
  const acknowledged = fixture();
  acknowledged.remote[0].state = "Done";
  acknowledged.remote[0].assignedState = "Done";
  mergeIncoming(acknowledged, structuredClone(acknowledged.remote), new Set());
  assert.equal(acknowledged.cloud?.rollupPending, undefined);
  const bad = structuredClone(acknowledged);
  acknowledged.cloud!.rollupPending = true;
  bad.cloud!.rollupPending = false;
  assert.throws(() => assertIncomingDelta(acknowledged, bad), /clear pending/);
});
