import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import {
  incomingContext,
  refreshIncoming,
} from "../../src/cloud/incoming-refresh";
import { connectDelivery, disconnectDelivery } from "../../src/cloud/session";
import { setTaskTextEditing } from "../../src/domain/task-editing";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { incomingMarks } from "../../src/youtrack/incoming-revision";
import { normalize, type RawIssue } from "../../src/youtrack/read-tasks";
import { required } from "../fixtures/values";
const gate = <T,>() => {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
const raw = (id: string, updated = 1): RawIssue => ({
  id: "db-" + id,
  idReadable: id,
  updated,
  summary: id,
  description: "",
  project: { shortName: "PMON" },
  customFields: [
    { name: "State", value: { name: "To do" } },
    { name: "Priority", value: { name: "Normal" } },
  ],
  commentsCount: 0,
});
const setup = async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 100000,
    revision = 0;
  let remote = [raw("PMON-1"), raw("PMON-2"), raw("PMON-3")];
  let saved = emptyWorkspace();
  saved.remote = remote.map(normalize);
  let hold: ReturnType<typeof gate<Response>> | undefined;
  let started: ReturnType<typeof gate<void>> | undefined;
  let fail = false,
    reads = 0,
    probes = 0,
    singles = 0;
  Date.now = () => now;
  globalThis.fetch = async (input, options) => {
    assert.equal(options?.method, "GET", "incoming must never write HTTP");
    const url = new URL(String(input));
    if (url.pathname.endsWith("users/me"))
      return Response.json({ id: "user-A" });
    const single = /issues\/(PMON-\d+)$/.exec(url.pathname)?.[1];
    if (single) {
      singles++;
      if (fail) throw Error("offline fixture");
      const issue = remote.find((item) => item.idReadable === single);
      return issue ? Response.json(issue) : new Response(null, { status: 404 });
    }
    assert.ok(url.pathname.endsWith("issues"));
    if (url.searchParams.get("fields") === "idReadable,updated") {
      probes++;
      if (fail) throw Error("offline fixture");
      return Response.json(
        remote.map((item) => ({
          idReadable: item.idReadable,
          updated: item.updated,
        })),
      );
    }
    reads++;
    if (fail) throw Error("offline fixture");
    if (hold) {
      started?.release();
      return hold.promise;
    }
    return Response.json(remote);
  };
  disconnectDelivery();
  await workspaceStore.switchPersistence({
    load: async () => ({ data: structuredClone(saved), revision }),
    save: async (data: WorkspaceData, expected: number) => {
      assert.equal(expected, revision);
      saved = structuredClone(data);
      return ++revision;
    },
  });
  const session = (userId = "user-A", projectId = "project-PMON") =>
    setAuthSession({
      token: "synthetic-token",
      expiresAt: now + 60000,
      userId,
      projectId,
    });
  session();
  await connectDelivery("synthetic-token", "user-A");
  assert.ok(incomingContext(), "Connected synthetic context must be available");
  return {
    setRemote: (items: RawIssue[]) => {
      remote = items;
    },
    advance: (milliseconds = 1100) => {
      now += milliseconds;
    },
    session,
    hold: () => {
      hold = gate<Response>();
      started = gate<void>();
      return {
        started: started.promise,
        release: () => {
          const current = hold;
          hold = undefined;
          current?.release(Response.json(remote));
        },
      };
    },
    fail: (value: boolean) => {
      fail = value;
    },
    counts: () => ({ reads, probes }),
    singles: () => singles,
    close: () => {
      disconnectDelivery();
      setAuthSession(null);
      globalThis.fetch = originalFetch;
      Date.now = originalNow;
      setTaskTextEditing("PMON-1:title", false);
    },
  };
};
test("real request pipeline coalesces reads; active editor A held while B updates, cached data applies after blur", async () => {
  const env = await setup();
  try {
    setTaskTextEditing("PMON-1:title", true);
    env.setRemote([
      { ...raw("PMON-1", 2), summary: "A new" },
      { ...raw("PMON-2", 2), summary: "B new" },
      raw("PMON-3"),
    ]);
    const held = env.hold();
    const first = refreshIncoming("full");
    await Promise.race([held.started, first]);
    assert.equal(refreshIncoming("full"), first);
    held.release();
    await first;
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "PMON-1",
    );
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[1]).summary,
      "B new",
    );
    setTaskTextEditing("PMON-1:title", false);
    await refreshIncoming();
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "A new",
    );
    assert.deepEqual(env.counts(), { reads: 1, probes: 1 });
    assert.equal(workspaceStore.getSnapshot().data.operations.length, 0);
  } finally {
    env.close();
  }
});
test("account or project session change while full read is pending cannot apply stale results", async () => {
  for (const scope of [
    ["user-B", "project-PMON"],
    ["user-A", "different-project"],
  ]) {
    const env = await setup();
    try {
      env.setRemote([{ ...raw("PMON-1", 2), summary: "stale" }]);
      const held = env.hold();
      const running = refreshIncoming("full");
      const rejected = assert.rejects(
        running,
        /session changed|workspace changed/,
      );
      await Promise.race([held.started, running]);
      env.session(...(scope as [string, string]));
      held.release();
      await rejected;
      assert.equal(
        required(workspaceStore.getSnapshot().data.remote[0]).summary,
        "PMON-1",
      );
    } finally {
      env.close();
    }
  }
});
test("delivery epoch change during read rejects snapshot; rejected refresh releases single-flight for retry", async () => {
  const env = await setup();
  try {
    env.setRemote([{ ...raw("PMON-1", 2), summary: "new" }]);
    const held = env.hold();
    const running = refreshIncoming("full");
    const rejected = assert.rejects(running, /workspace changed/);
    await Promise.race([held.started, running]);
    await workspaceStore.deliver(async () => {});
    held.release();
    await rejected;
    await refreshIncoming("full");
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "new",
    );
  } finally {
    env.close();
  }
});
test("older full response cannot undo newer per-ticket baseline, failures preserve cache and allow retry", async () => {
  const env = await setup();
  try {
    await workspaceStore.applyIncoming(
      [{ ...normalize(raw("PMON-1", 5)), summary: "latest" }],
      new Set(),
      () => {},
    );
    env.setRemote([raw("PMON-1", 2)]);
    await refreshIncoming("full");
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "latest",
    );
    env.advance();
    env.fail(true);
    await assert.rejects(refreshIncoming("full"), /offline fixture/);
    env.fail(false);
    env.setRemote([{ ...raw("PMON-2", 6), summary: "after retry" }]);
    await refreshIncoming("full");
    assert.equal(
      workspaceStore
        .getSnapshot()
        .data.remote.find((item) => item.id === "PMON-2")?.summary,
      "after retry",
    );
    assert.ok(
      workspaceStore
        .getSnapshot()
        .data.cloud?.unavailable?.tasks.some((item) => item.id === "PMON-1"),
    );
  } finally {
    env.close();
  }
});
test("queued deletion and attachment remain untouched while unrelated incoming ticket refreshes", async () => {
  const env = await setup();
  try {
    await workspaceStore.change((data) => {
      data.operations = [
        {
          type: "delete",
          opId: "delete",
          issueId: "PMON-1",
          ids: ["PMON-1"],
          bases: { "PMON-1": required(data.remote[0]) },
        },
        {
          type: "attachment",
          opId: "11111111-1111-4111-8111-111111111111",
          issueId: "PMON-2",
          uploadId: "11111111-1111-4111-8111-111111111111",
          file: {
            name: "keep.txt",
            size: 1,
            mimeType: "text/plain",
            hash: "a".repeat(64),
          },
        },
      ];
    });
    const before = structuredClone(
      workspaceStore.getSnapshot().data.operations,
    );
    env.setRemote([
      raw("PMON-1", 2),
      raw("PMON-2", 2),
      { ...raw("PMON-3", 2), summary: "independent" },
    ]);
    await refreshIncoming("full");
    assert.deepEqual(workspaceStore.getSnapshot().data.operations, before);
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).updated,
      1,
    );
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[1]).updated,
      1,
    );
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[2]).summary,
      "independent",
    );
  } finally {
    env.close();
  }
});
test("reconnecting creates a new port and cannot reuse held old-port cached snapshot", async () => {
  const env = await setup();
  try {
    setTaskTextEditing("PMON-1:title", true);
    env.setRemote([{ ...raw("PMON-1", 2), summary: "old cache" }]);
    await refreshIncoming("full");
    disconnectDelivery();
    await connectDelivery("synthetic-token", "user-A");
    env.setRemote([{ ...raw("PMON-1", 3), summary: "fresh port" }]);
    setTaskTextEditing("PMON-1:title", false);
    await refreshIncoming();
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "fresh port",
    );
    assert.equal(env.counts().reads, 2);
  } finally {
    env.close();
  }
});
test("revision probe validates IDs and finite safe timestamps without any write method", async () => {
  for (const result of [
    null,
    {},
    [{ idReadable: "OTHER-1", updated: 1 }],
    [{ idReadable: "PMON-1", updated: NaN }],
    [{ idReadable: "PMON-1", updated: -1 }],
    [{ idReadable: "PMON-1", updated: 1.5 }],
    [
      { idReadable: "PMON-1", updated: 1 },
      { idReadable: "PMON-1", updated: 2 },
    ],
  ])
    await assert.rejects(incomingMarks(async () => result));
  const marks = await incomingMarks(async (route, method) => {
    assert.equal(method, undefined);
    assert.match(route, /updated/);
    return [
      { idReadable: "PMON-2", updated: 2 },
      { idReadable: "PMON-1", updated: 1 },
    ];
  });
  assert.deepEqual([...(marks ?? [])], [["PMON-2", 2], ["PMON-1", 1]]);
  const tooMany = Array.from({ length: 2000 }, (_, index) => ({
    idReadable: `PMON-${index + 1}`,
    updated: 1,
  }));
  assert.equal(await incomingMarks(async () => tooMany), null);
});

test("same-account persistence switch fences a pending read and stale cached auth cannot apply", async () => {
  const env = await setup();
  try {
    env.setRemote([{ ...raw("PMON-1", 2), summary: "old workspace" }]);
    const held = env.hold();
    const running = refreshIncoming("full");
    const rejected = assert.rejects(running, /workspace changed/);
    await Promise.race([held.started, running]);
    const replacement = emptyWorkspace();
    replacement.remote = [normalize(raw("PMON-1", 1))];
    replacement.cloud = { accountId: "user-A", autoSync: true, records: {} };
    let revision = 0;
    await workspaceStore.switchPersistence({
      load: async () => ({ data: replacement, revision }),
      save: async () => ++revision,
    });
    held.release();
    await rejected;
    setTaskTextEditing("PMON-1:title", true);
    await refreshIncoming("full");
    env.session();
    setTaskTextEditing("PMON-1:title", false);
    await refreshIncoming();
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "PMON-1",
    );
  } finally {
    env.close();
  }
});
test("incoming refresh remains available during active delivery for unrelated tickets", async () => {
  const env = await setup();
  const release = gate<void>(),
    started = gate<void>();
  let running: Promise<void> | undefined;
  try {
    await workspaceStore.change((data) => {
      data.operations.push({
        type: "edit",
        opId: "held",
        issueId: "PMON-1",
        base: structuredClone(required(data.remote[0])),
        patch: { priority: "High" },
      });
    });
    running = workspaceStore.deliver(async () => {
      started.release();
      await release.promise;
    });
    await started.promise;
    env.setRemote([
      { ...raw("PMON-1", 2), summary: "locked" },
      { ...raw("PMON-2", 2), summary: "unrelated fresh" },
    ]);
    await refreshIncoming("full");
    assert.equal(workspaceStore.getSnapshot().delivering, true);
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "PMON-1",
    );
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[1]).summary,
      "unrelated fresh",
    );
  } finally {
    release.release();
    await running;
    env.close();
  }
});

test("watcher shutdown prevents an in-flight snapshot from applying; malformed full snapshots never mutate", async () => {
  const env = await setup();
  let alive = true;
  try {
    env.setRemote([{ ...raw("PMON-1", 2), summary: "after stop" }]);
    const held = env.hold();
    const running = refreshIncoming("full", () => alive);
    const rejected = assert.rejects(running, /watcher stopped/);
    await Promise.race([held.started, running]);
    alive = false;
    held.release();
    await rejected;
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "PMON-1",
    );
    env.setRemote([raw("PMON-1", 2), raw("PMON-1", 2)]);
    await assert.rejects(refreshIncoming("full"), /duplicate|invalid/i);
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).updated,
      1,
    );
    env.setRemote([{ ...raw("PMON-1", 3), summary: "retry valid" }]);
    await refreshIncoming("full");
    assert.equal(
      required(workspaceStore.getSnapshot().data.remote[0]).summary,
      "retry valid",
    );
  } finally {
    env.close();
  }
});

test("the light check finds deletions and edits anywhere, reading only what changed", async () => {
  const env = await setup();
  try {
    const items = Array.from({ length: 12 }, (_, index) =>
      raw(`PMON-${index + 1}`, 12 - index),
    );
    env.setRemote(items);
    await refreshIncoming();
    assert.deepEqual(env.counts(), { reads: 1, probes: 0 });
    assert.equal(workspaceStore.getSnapshot().data.remote.length, 12);
    await refreshIncoming();
    assert.deepEqual(env.counts(), { reads: 1, probes: 1 });
    // PMON-12 is the oldest update, which a top-ten probe never saw.
    env.setRemote(items.slice(0, 11));
    await refreshIncoming();
    assert.deepEqual(env.counts(), { reads: 1, probes: 2 });
    const remote = () => workspaceStore.getSnapshot().data.remote;
    assert.ok(!remote().some((item) => item.id === "PMON-12"));
    assert.ok(
      workspaceStore
        .getSnapshot()
        .data.cloud?.unavailable?.tasks.some((item) => item.id === "PMON-12"),
    );
    env.setRemote([
      ...items.slice(0, 10),
      { ...raw("PMON-11", 50), summary: "edited old task" },
    ]);
    await refreshIncoming();
    assert.deepEqual(env.counts(), { reads: 1, probes: 3 });
    assert.equal(env.singles(), 1);
    assert.equal(
      remote().find((item) => item.id === "PMON-11")?.summary,
      "edited old task",
    );
    assert.deepEqual(workspaceStore.getSnapshot().data.operations, []);
  } finally {
    env.close();
  }
});
test("a read that overlaps the end of a delivery cannot restore a task the delivery deleted", async () => {
  const env = await setup();
  const finish = gate<void>(),
    started = gate<void>();
  try {
    const delivery = workspaceStore.deliver(async (commit) => {
      started.release();
      await finish.promise;
      await commit((data) => {
        data.remote = data.remote.filter((item) => {
          return item.id !== "PMON-3";
        });
      });
    });
    await started.promise;
    // YouTrack answers this read with PMON-3 as it was before the deletion.
    const held = env.hold();
    const running = refreshIncoming("full");
    const rejected = assert.rejects(running, /workspace changed/);
    await Promise.race([held.started, running]);
    finish.release();
    await delivery;
    held.release();
    await rejected;
    const ids = workspaceStore.getSnapshot().data.remote.map((item) => {
      return item.id;
    });
    assert.deepEqual(ids, ["PMON-1", "PMON-2"]);
    assert.notEqual(
      workspaceStore.getSnapshot().data.cloud?.rollupPending,
      true,
    );
  } finally {
    env.close();
  }
});
