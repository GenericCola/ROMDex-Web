import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import { connectDelivery, disconnectDelivery } from "../../src/cloud/session";
import { watchIncoming } from "../../src/cloud/watch-incoming";
import { setTaskTextEditing } from "../../src/domain/task-editing";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { normalize, type RawIssue } from "../../src/youtrack/read-tasks";

test("watcher backs off failed reads, waits hidden, resumes on focus, coalesces wakeups and cleans up", async () => {
  const saved = {
    fetch: globalThis.fetch,
    now: Date.now,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  };
  const win = Object.assign(new EventTarget(), {
    location: { href: "https://fixture.invalid/" },
    sessionStorage: { getItem: () => null },
  });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  let now = 100000,
    id = 0,
    requests = 0,
    fail = true,
    revision = 0;
  const timers = new Map<number, { at: number; callback: () => unknown }>();
  const raw: RawIssue = {
    id: "db1",
    idReadable: "PMON-1",
    summary: "Synthetic",
    description: "",
    project: { shortName: "PMON" },
    updated: 1,
    customFields: [{ name: "State", value: { name: "To do" } }],
  };
  const data = emptyWorkspace();
  data.remote = [normalize(raw)];
  let stop: (() => void) | undefined;
  let heldResponse: Promise<Response> | undefined;
  let releaseResponse: ((response: Response) => void) | undefined;
  const advance = async (ms: number) => {
    now += ms;
    for (const [key, timer] of [...timers])
      if (timer.at <= now) {
        timers.delete(key);
        await timer.callback();
        await new Promise<void>((resolve) => saved.setTimeout(resolve, 0));
      }
  };
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: win,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: doc,
    });
    Date.now = () => now;
    globalThis.fetch = async (input, options) => {
      assert.equal(options?.method, "GET");
      const url = new URL(String(input));
      if (url.pathname.endsWith("users/me"))
        return Response.json({ id: "user-A" });
      requests++;
      if (fail) throw Error("synthetic offline");
      if (url.searchParams.get("$top") !== "10" && heldResponse)
        return heldResponse;
      return Response.json(
        url.searchParams.get("$top") === "10"
          ? [{ idReadable: "PMON-1", updated: raw.updated }]
          : [raw],
      );
    };
    disconnectDelivery();
    await workspaceStore.switchPersistence({
      load: async () => ({ data, revision }),
      save: async () => ++revision,
    });
    setAuthSession({
      token: "synthetic",
      expiresAt: now + 1000000,
      userId: "user-A",
      projectId: "project-PMON",
    });
    await connectDelivery("synthetic", "user-A");
    globalThis.setTimeout = ((callback: () => unknown, delay = 0) => {
      const key = ++id;
      timers.set(key, { at: now + delay, callback });
      return key;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((key: number) => {
      timers.delete(key);
    }) as unknown as typeof clearTimeout;
    stop = watchIncoming();
    await advance(100);
    assert.equal(requests, 1);
    assert.equal([...timers.values()][0].at - now, 15000);
    await advance(15000);
    assert.equal(requests, 2);
    assert.equal([...timers.values()][0].at - now, 30000);
    await advance(30000);
    assert.equal(requests, 3);
    assert.equal([...timers.values()][0].at - now, 60000);
    await advance(60000);
    assert.equal(requests, 4);
    assert.equal([...timers.values()][0].at - now, 60000);
    doc.visibilityState = "hidden";
    await advance(60000);
    assert.equal(requests, 4);
    assert.equal([...timers.values()][0].at - now, 3000);
    fail = false;
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("online"));
    assert.equal(timers.size, 1);
    await advance(100);
    assert.equal(requests, 6);
    assert.equal([...timers.values()][0].at - now, 3000);
    await advance(3000);
    assert.equal(requests, 7);
    assert.equal(timers.size, 1);
    raw.updated = 2;
    heldResponse = new Promise<Response>((resolve) => {
      releaseResponse = resolve;
    });
    setTaskTextEditing("PMON-1:title", true);
    await advance(3000);
    assert.equal(timers.size, 0, "full read is held in flight");
    setTaskTextEditing("PMON-1:title", false);
    releaseResponse?.(Response.json([raw]));
    await new Promise<void>((resolve) => saved.setTimeout(resolve, 0));
    assert.equal(
      [...timers.values()][0].at - now,
      250,
      "blur during busy schedules prompt reapply",
    );
    stop();
    assert.equal(timers.size, 0);
    win.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(timers.size, 0);
  } finally {
    stop?.();
    releaseResponse?.(Response.json([raw]));
    setTaskTextEditing("PMON-1:title", false);
    disconnectDelivery();
    setAuthSession(null);
    globalThis.fetch = saved.fetch;
    Date.now = saved.now;
    globalThis.setTimeout = saved.setTimeout;
    globalThis.clearTimeout = saved.clearTimeout;
    for (const [key, value] of [
      ["window", saved.window],
      ["document", saved.document],
    ] as const) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
