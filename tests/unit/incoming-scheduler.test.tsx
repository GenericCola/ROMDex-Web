import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import { connectDelivery, disconnectDelivery } from "../../src/cloud/session";
import { watchIncoming } from "../../src/cloud/watch-incoming";
import { setTaskTextEditing } from "../../src/domain/task-editing";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { normalize, type RawIssue } from "../../src/youtrack/read-tasks";

test("watcher never reads on a timer: it reads on connect, focus, visibility and online, coalesces wakeups and cleans up", async () => {
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
      return Response.json(
        url.searchParams.get("fields") === "idReadable,updated"
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
      expiresAt: now + 10 * 60 * 60_000,
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
    const settle = async () => {
      for (let round = 0; round < 20; round++)
        await new Promise<void>((resolve) => saved.setTimeout(resolve, 0));
    };
    stop = watchIncoming();
    await settle();
    assert.equal(requests, 1, "connecting reads once");
    await advance(60 * 60_000);
    await settle();
    assert.equal(requests, 1, "a failed read is not retried on a timer");
    doc.visibilityState = "hidden";
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("online"));
    await settle();
    assert.equal(requests, 1, "a hidden window does not read");
    fail = false;
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("online"));
    await settle();
    // The first event reads everything; the two that arrived meanwhile share
    // one light check.
    assert.equal(requests, 3);
    await advance(60 * 60_000);
    await settle();
    assert.equal(requests, 3, "an idle visible window does not read");
    setTaskTextEditing("PMON-1:title", true);
    setTaskTextEditing("PMON-1:title", false);
    await advance(250);
    await settle();
    assert.equal(requests, 3, "closing an editor re-applies without a read");
    stop();
    win.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    assert.equal(requests, 3);
  } finally {
    stop?.();
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
