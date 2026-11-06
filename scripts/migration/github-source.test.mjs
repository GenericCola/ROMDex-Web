import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { createGitHubSource } from "./github-source.mjs";

const REPO = "Org/Data";
const TOKEN = "ghp_secret_token_123";
const sha1 = (buf) =>
  createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");

const contents = {
  "a.json": Buffer.from('{"a":1}'),
  "dir/b.txt": Buffer.from("hello b"),
  "dir/c.bin": Buffer.from([0, 1, 2, 255, 254]),
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

const makeFake = (overrides = {}) => {
  const state = {
    head: "c".repeat(40),
    truncated: false,
    calls: [],
    inFlight: 0,
    maxInFlight: 0,
    wrongBytes: false,
    failures: [],
    ...overrides,
  };
  const blobsBySha = new Map();
  const tree = [{ path: "dir", type: "tree", sha: "d".repeat(40) }];
  for (const [p, buf] of Object.entries(contents)) {
    blobsBySha.set(sha1(buf), buf);
    tree.push({ path: p, type: "blob", sha: sha1(buf), size: buf.length });
  }
  const fake = async (url, init) => {
    state.calls.push({ url, init });
    if (state.failures.length > 0) return state.failures.shift()();
    const u = new URL(url);
    const p = u.pathname;
    if (p === `/repos/${REPO}/branches/main`) {
      return json({ commit: { sha: state.head } });
    }
    if (p === `/repos/${REPO}/git/commits/${state.head}`) {
      return json({
        tree: { sha: "t".repeat(40) },
        committer: { date: "2026-01-02T03:04:05Z" },
      });
    }
    if (p === `/repos/${REPO}/git/trees/${"t".repeat(40)}`) {
      return json({ tree, truncated: state.truncated });
    }
    const m = p.match(/\/git\/blobs\/([0-9a-f]{40})$/);
    if (m && blobsBySha.has(m[1])) {
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      await new Promise((r) => setTimeout(r, 5));
      state.inFlight -= 1;
      const buf = state.wrongBytes
        ? Buffer.from("tampered")
        : blobsBySha.get(m[1]);
      return new Response(buf, { status: 200 });
    }
    return json({ message: "Not Found" }, 404);
  };
  return { fake, state };
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gh-source-"));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

let counter = 0;
const setup = (overrides = {}, options = {}) => {
  const { fake, state } = makeFake(overrides);
  const cacheDir = path.join(tmpRoot, `cache-${counter++}`);
  const source = createGitHubSource({
    repo: REPO,
    token: TOKEN,
    fetch: fake,
    cacheDir,
    sleep: async () => {},
    ...options,
  });
  return { source, state, cacheDir };
};

describe("github-source", () => {
  beforeEach(() => {});

  it("pin returns commit, tree, committedAt and only blobs", async () => {
    const { source, state } = setup();
    const pinned = await source.pin();
    assert.equal(pinned.commit, state.head);
    assert.equal(pinned.tree, "t".repeat(40));
    assert.equal(pinned.committedAt, "2026-01-02T03:04:05Z");
    assert.deepEqual(
      [...pinned.files.keys()].sort(),
      Object.keys(contents).sort(),
    );
    assert.deepEqual(pinned.files.get("a.json"), {
      sha: sha1(contents["a.json"]),
      size: contents["a.json"].length,
    });
  });

  it("pin throws on a truncated tree", async () => {
    const { source } = setup({ truncated: true });
    await assert.rejects(source.pin(), /truncated/);
  });

  it("readBlob throws before pin and for unknown paths", async () => {
    const { source } = setup();
    await assert.rejects(source.readBlob("a.json"), /before pin/);
    await source.pin();
    await assert.rejects(source.readBlob("nope.txt"), /nope\.txt/);
  });

  it("readBlob downloads, verifies and caches", async () => {
    const { source, state, cacheDir } = setup();
    await source.pin();
    const first = await source.readBlob("dir/b.txt");
    assert.deepEqual(first, contents["dir/b.txt"]);
    const sha = sha1(contents["dir/b.txt"]);
    assert.ok(
      fs.existsSync(path.join(cacheDir, "blobs", sha.slice(0, 2), sha)),
    );
    const callsAfterFirst = state.calls.length;
    const second = await source.readBlob("dir/b.txt");
    assert.deepEqual(second, contents["dir/b.txt"]);
    assert.equal(state.calls.length, callsAfterFirst);
    assert.equal(source.stats.downloads, 1);
    assert.equal(source.stats.cacheHits, 1);
    assert.equal(source.stats.downloadedBytes, contents["dir/b.txt"].length);
  });

  it("rejects bytes that do not match the sha", async () => {
    const { source, state } = setup();
    await source.pin();
    state.wrongBytes = true;
    await assert.rejects(source.readBlob("a.json"), /verification failed/);
  });

  it("re-downloads a corrupted cache file", async () => {
    const { source, cacheDir } = setup();
    await source.pin();
    await source.readBlob("a.json");
    const sha = sha1(contents["a.json"]);
    const file = path.join(cacheDir, "blobs", sha.slice(0, 2), sha);
    fs.writeFileSync(file, "garbage");
    const bytes = await source.readBlob("a.json");
    assert.deepEqual(bytes, contents["a.json"]);
    assert.equal(source.stats.downloads, 2);
    assert.deepEqual(fs.readFileSync(file), contents["a.json"]);
  });

  it("readMany returns everything within the concurrency limit", async () => {
    const { source, state } = setup({}, { concurrency: 2 });
    await source.pin();
    const result = await source.readMany(Object.keys(contents));
    assert.equal(result.size, 3);
    for (const [p, buf] of Object.entries(contents)) {
      assert.deepEqual(result.get(p), buf);
    }
    assert.ok(state.maxInFlight <= 2);
    assert.ok(state.maxInFlight >= 1);
  });

  it("sends only GET requests with auth and never leaks the token", async () => {
    const { source, state } = setup();
    await source.pin();
    await source.readBlob("a.json");
    for (const { init } of state.calls) {
      assert.equal(init.method, "GET");
      assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(init.headers["User-Agent"], "romdex-migration");
    }
    state.failures.push(
      () => new Response("x", { status: 500 }),
      () => new Response("x", { status: 500 }),
      () => new Response("x", { status: 500 }),
    );
    await assert.rejects(source.headNow(), (e) => {
      assert.ok(!e.message.includes(TOKEN));
      assert.match(e.message, /500/);
      return true;
    });
    state.failures.push(() => json({ message: "Not Found" }, 404));
    await assert.rejects(source.pin(), (e) => {
      assert.ok(!e.message.includes(TOKEN));
      assert.match(e.message, /404/);
      return true;
    });
  });

  it("retries 5xx then succeeds", async () => {
    const { source, state } = setup();
    state.failures.push(
      () => new Response("x", { status: 502 }),
      () => {
        throw new Error("socket hang up");
      },
    );
    assert.equal(await source.headNow(), state.head);
    assert.equal(state.calls.length, 3);
  });

  it("retries a body that is cut off mid-read", async () => {
    const { source, state } = setup();
    await source.pin();
    const cutOff = () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new TypeError("terminated"));
          },
        }),
        { status: 200 },
      );
    state.failures.push(cutOff);
    assert.deepEqual(await source.readBlob("a.json"), contents["a.json"]);
    assert.equal(state.calls.length, 5);
  });

  it("throws on rate limit without retrying", async () => {
    const { source, state } = setup();
    state.failures.push(
      () =>
        new Response("x", {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1800000000",
          },
        }),
    );
    await assert.rejects(source.headNow(), /rate limit reached, resets at/);
    assert.equal(state.calls.length, 1);
  });

  it("assertUnmoved passes when unchanged and throws HEAD_MOVED otherwise", async () => {
    const { source, state } = setup();
    await source.pin();
    await source.assertUnmoved();
    const pinnedHead = state.head;
    state.head = "f".repeat(40);
    await assert.rejects(source.assertUnmoved(), (e) => {
      assert.equal(e.code, "HEAD_MOVED");
      assert.ok(e.message.includes(pinnedHead));
      assert.ok(e.message.includes(state.head));
      return true;
    });
  });
});
