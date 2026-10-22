import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
const template = await readFile("scripts/service-worker.js", "utf8");
const worker = (options = {}) => {
  const handlers = {};
  const deleted = [];
  const cached = [];
  let skipped = false;
  let claimed = false;
  const cache = {
    addAll: async (assets) => {
      if (options.fail) throw Error("missing asset");
      cached.push(...assets);
    },
    match: async (key) => ({ key }),
  };
  const self = {
    location: { origin: "https://romdex.test" },
    registration: { scope: "https://romdex.test/" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    clients: {
      matchAll: async () =>
        options.clients ?? [{ id: "current", url: "https://romdex.test/" }],
      claim: async () => {
        claimed = true;
      },
    },
    skipWaiting: async () => {
      skipped = true;
    },
  };
  vm.runInNewContext(
    template
      .replace("__VERSION__", "new")
      .replace(
        "__ASSETS__",
        JSON.stringify(["/index.html", "/nested/index.html", "/app.js"]),
      ),
    {
      self,
      URL,
      Set,
      fetch: async () => ({ network: true }),
      caches: {
        open: async () => cache,
        delete: async (name) => deleted.push(name),
        keys: async () => ["unrelated", "romdex-shell-old", "romdex-shell-new"],
      },
    },
  );
  return {
    handlers,
    deleted,
    cached,
    skipped: () => skipped,
    claimed: () => claimed,
  };
};
const request = (url, extra = {}) => ({
  url,
  method: "GET",
  headers: new Headers(),
  ...extra,
});
test("worker bypasses non-shell and private requests", () => {
  const w = worker();
  for (const req of [
    request("https://elsewhere.test/app.js"),
    request("https://romdex.test/app.js?token=x"),
    request("https://romdex.test/app.js", { method: "POST" }),
    request("https://romdex.test/app.js", {
      headers: new Headers({ Authorization: "secret" }),
    }),
    request("https://romdex.test/user-data"),
  ]) {
    let intercepted = false;
    w.handlers.fetch({
      request: req,
      respondWith: () => {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
});
test("nested navigations use exported index files", async () => {
  const w = worker();
  let response;
  w.handlers.fetch({
    request: request("https://romdex.test/nested/", { mode: "navigate" }),
    respondWith: (promise) => (response = promise),
  });
  assert.equal((await response).key, "/nested/index.html");
});
test("failed installation removes only incomplete new cache", async () => {
  const w = worker({ fail: true });
  let promise;
  w.handlers.install({ waitUntil: (p) => (promise = p) });
  await assert.rejects(promise);
  assert.deepEqual(w.deleted, ["romdex-shell-new"]);
  assert.equal(w.skipped(), false);
});
test("complete precache waits for consent", async () => {
  const w = worker();
  let promise;
  w.handlers.install({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.equal(w.cached.length, 3);
  assert.equal(w.skipped(), false);
});
test("activation preserves unrelated caches", async () => {
  const w = worker();
  let promise;
  w.handlers.activate({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.deepEqual(w.deleted, ["romdex-shell-old"]);
  assert.equal(w.claimed(), true);
});
for (const blocked of [true, false])
  test("update consent with other windows: " + blocked, async () => {
    const w = worker({
      clients: [
        { id: "current", url: "https://romdex.test/" },
        ...(blocked ? [{ id: "other", url: "https://romdex.test/" }] : []),
      ],
    });
    let promise;
    let reply;
    w.handlers.message({
      data: { type: "ACTIVATE_UPDATE" },
      source: { id: "current" },
      ports: [{ postMessage: (value) => (reply = value) }],
      waitUntil: (p) => (promise = p),
    });
    await promise;
    assert.equal(reply.blocked, blocked);
    assert.equal(w.skipped(), !blocked);
  });
