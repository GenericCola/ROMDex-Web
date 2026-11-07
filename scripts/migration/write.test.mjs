import assert from "node:assert/strict";
import { test } from "node:test";
import { createArticle, STORE_TARGETS } from "../../src/store/core/index.ts";
import { buildPlan } from "./plan.mjs";
import {
  BASE_EDITS,
  fakeSource,
  PNG_URL,
  useSyntheticFixture,
} from "./test-fixtures.mjs";
import { runWrite, writeTargets } from "./write.mjs";

// ---- in-memory fake YouTrack ----

function fakeYouTrack() {
  const articles = new Map(); // id -> article
  const attachments = new Map(); // attId -> {id, article, name, size, bytes}
  const calls = [];
  const state = { tamperAfterCommit: false, nextArticle: 1, nextAtt: 1 };
  const view = (a) => ({
    id: a.id,
    idReadable: a.idReadable,
    summary: a.summary,
    content: a.content,
    updated: a.updated,
    project: { id: a.projectId },
  });
  const attView = (a) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    url: `/api/files/${a.id}`,
    removed: false,
  });
  const find = (id) => articles.get(id) ?? null;

  const transport = {
    async request(route, method = "GET", body) {
      calls.push({ method, route });
      const [path, qs = ""] = route.split("?");
      const params = new URLSearchParams(qs);
      const parts = path.split("/");
      if (parts[0] !== "articles") throw new Error(`Unexpected route ${route}`);
      if (parts.length === 1) {
        if (method === "GET") {
          const q = (params.get("query") ?? "").replace(/^\{|\}$/g, "");
          return [...articles.values()]
            .filter((a) => a.summary.includes(q))
            .map(view);
        }
        const id = `1-${state.nextArticle}`;
        const a = {
          id,
          idReadable: `TST-A-${state.nextArticle++}`,
          summary: body.summary,
          content: body.content,
          projectId: body.project.id,
          visibility: body.visibility,
          updated: 1000,
        };
        articles.set(id, a);
        return view(a);
      }
      const article = find(parts[1]);
      if (parts.length === 2) {
        if (method === "GET") return article ? view(article) : null;
        assert.ok(article, "update of a missing article");
        article.content = body.content;
        article.updated += 1;
        state.tamperAfterCommit = state.tamperEnabled === true;
        return { id: article.id };
      }
      assert.equal(parts[2], "attachments");
      assert.ok(article, "attachments of a missing article");
      if (parts.length === 4) {
        const att = attachments.get(parts[3]);
        return att && att.article === article.id ? attView(att) : null;
      }
      if (method === "GET") {
        const all = [...attachments.values()].filter(
          (a) => a.article === article.id,
        );
        const skip = Number(params.get("$skip") ?? 0);
        const top = Number(params.get("$top") ?? 100);
        return all.slice(skip, skip + top).map(attView);
      }
      const file = body.get("upload");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const att = {
        id: `8-${state.nextAtt++}`,
        article: article.id,
        name: file.name,
        size: bytes.length,
        bytes,
      };
      attachments.set(att.id, att);
      article.updated += 1;
      return [{ id: att.id, name: att.name, size: att.size }];
    },
    async download(url, size) {
      const att = attachments.get(url.split("/").pop());
      if (!att) throw new Error("no such file");
      const bytes = Uint8Array.from(att.bytes);
      if (state.tamperAfterCommit) bytes[0] ^= 0xff;
      assert.equal(bytes.length, size);
      return bytes;
    },
  };
  return {
    transport,
    articles,
    attachments,
    calls,
    state,
    posts: () => calls.filter((c) => c.method !== "GET"),
    byTitle: (title) => [...articles.values()].find((a) => a.summary === title),
  };
}

// ---- shared setup ----

const fixture = useSyntheticFixture({
  edits: BASE_EDITS,
  npcdexDoc: {
    version: 2,
    revision: 4,
    towns: [
      {
        id: "town-a",
        name: "A",
        characters: [{ id: 1, portrait: PNG_URL }],
        areas: [{ elements: [{ points: [{ blocks: [1, 2] }] }] }],
      },
    ],
    annotations: { a1: { image: PNG_URL, note: "hi" } },
    changePlans: { p1: {} },
    history: [{ at: 1 }],
  },
});

const makePlan = async (opts = {}) => {
  const github = fakeSource(new Map(fixture().files), opts);
  const plan = await buildPlan({ source: github, target: "test" });
  github.calls.assertUnmoved = 0;
  return { plan, github };
};

const targets = writeTargets({ target: "test" });
const meta = targets["romdex-metadata"];
const npc = targets.npcdex;
const WRITER = "2-1";

const run = (plan, yt, github) =>
  runWrite({
    plan,
    transport: yt.transport,
    github,
    targets,
    writtenBy: WRITER,
  });

const rewriteManifest = (article, edit) => {
  article.content = article.content.replace(
    /```json\n([\s\S]*?)\n```/,
    (_, t) => {
      const m = JSON.parse(t);
      edit(m);
      return `\`\`\`json\n${JSON.stringify(m, null, 2)}\n\`\`\``;
    },
  );
};

// ---- 1. writeTargets ----

test("writeTargets: test titles, project and users", () => {
  const t = writeTargets({ target: "test" });
  assert.equal(
    t["romdex-metadata"].title,
    "ROMDex data (migration test, safe to delete)",
  );
  assert.equal(t.npcdex.title, "NPCDex data (migration test, safe to delete)");
  for (const store of ["romdex-metadata", "npcdex"]) {
    assert.equal(t[store].store, store);
    assert.equal(t[store].projectId, "0-4");
    assert.deepEqual(t[store].permittedUsers, ["2-1", "2-2"]);
  }
  const l = writeTargets({ target: "test", label: "x" });
  assert.equal(
    l.npcdex.title,
    "NPCDex data (migration test x, safe to delete)",
  );
  assert.equal(
    l["romdex-metadata"].title,
    "ROMDex data (migration test x, safe to delete)",
  );
});

test("writeTargets: bad label, production and unknown target", () => {
  for (const label of ["", "Bad", "a b", "x".repeat(25), "a/b"])
    assert.throws(
      () => writeTargets({ target: "test", label }),
      /--test-label/,
      label,
    );
  assert.equal(writeTargets({ target: "production" }), STORE_TARGETS);
  assert.equal(STORE_TARGETS["romdex-metadata"].projectId, "0-1");
  assert.equal(STORE_TARGETS.npcdex.projectId, "0-2");
  assert.throws(
    () => writeTargets({ target: "production", label: "x" }),
    /only for --target test/,
  );
  assert.throws(
    () => writeTargets({ target: "staging" }),
    /Unknown target staging/,
  );
});

// ---- 2. first run ----

test("first run creates, uploads, writes and verifies both stores", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  const receipt = await run(plan, yt, github);

  assert.equal(receipt.result, "written");
  assert.equal(receipt.source.headUnchanged, true);
  assert.equal(github.calls.assertUnmoved, 1);
  assert.equal(yt.articles.size, 2);
  const creates = yt.calls.filter(
    (c) => c.method === "POST" && c.route.startsWith("articles?"),
  );
  assert.equal(creates.length, 2);

  for (const [store, key, target] of [
    ["romdex-metadata", "metadata", meta],
    ["npcdex", "npcdex", npc],
  ]) {
    const article = yt.byTitle(target.title);
    assert.ok(article);
    assert.equal(article.projectId, "0-4");
    assert.equal(article.visibility.$type, "LimitedVisibility");
    assert.deepEqual(article.visibility.permittedUsers, [
      { id: "2-1" },
      { id: "2-2" },
    ]);

    const r = receipt.stores[store];
    assert.equal(r.result, "written");
    assert.equal(r.created, true);
    assert.equal(r.rebuiltSha256, r.expectedSha256);
    assert.equal(r.rebuiltSha256, plan[key].manifest.source.sha256);
    assert.deepEqual(r.manifest.source, plan[key].manifest.source);
    assert.equal(r.manifest.revision, 1);
    assert.equal(r.uploaded.length, plan[key].parts.length);
    assert.equal(r.files.length, plan[key].parts.length);
    assert.equal(r.downloadedParts, plan[key].parts.length);
    for (const f of r.files) {
      assert.ok(yt.attachments.has(f.id), `attachment ${f.id}`);
      assert.equal(yt.attachments.get(f.id).article, article.id);
    }
    assert.deepEqual(
      r.files.map((f) => f.key).sort(),
      plan[key].parts.map((p) => p.key).sort(),
    );
  }
  assert.equal(
    yt.attachments.size,
    plan.metadata.parts.length + plan.npcdex.parts.length,
  );
});

// ---- 3. second run ----

test("second run is already-migrated and makes no writes", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  await run(plan, yt, github);
  yt.calls.length = 0;
  const receipt = await run(plan, yt, github);
  assert.equal(receipt.result, "already-migrated");
  assert.equal(yt.posts().length, 0);
  assert.ok(yt.calls.length > 0);
  for (const store of ["romdex-metadata", "npcdex"]) {
    assert.equal(receipt.stores[store].result, "already-migrated");
    assert.equal(receipt.stores[store].created, false);
    assert.equal(
      receipt.stores[store].rebuiltSha256,
      receipt.stores[store].expectedSha256,
    );
  }
  assert.equal(yt.articles.size, 2);
});

// ---- 4. different content ----

test("a different source head stops the run with no writes", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  await run(plan, yt, github);
  rewriteManifest(yt.byTitle(meta.title), (m) => {
    m.source.head = "f".repeat(40);
  });
  yt.articles.delete(yt.byTitle(npc.title).id); // other store is missing
  yt.calls.length = 0;

  const receipt = await run(plan, yt, github);
  assert.equal(receipt.result, "stopped");
  assert.equal(receipt.stores["romdex-metadata"].result, "different-content");
  assert.ok(receipt.stores["romdex-metadata"].reason);
  assert.equal(
    receipt.stores["romdex-metadata"].difference.source.head,
    "f".repeat(40),
  );
  assert.equal(receipt.stores.npcdex.result, "not-created");
  assert.equal(yt.posts().length, 0);
});

test("a plain-text article with the title stops the run with no writes", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  await run(plan, yt, github);
  yt.byTitle(meta.title).content = "someone typed here";
  yt.calls.length = 0;

  const receipt = await run(plan, yt, github);
  assert.equal(receipt.result, "stopped");
  assert.equal(receipt.stores["romdex-metadata"].result, "different-content");
  assert.match(
    receipt.stores["romdex-metadata"].reason,
    /without a ROMDex manifest/,
  );
  assert.equal(receipt.stores.npcdex.result, "already-migrated");
  assert.equal(yt.posts().length, 0);
});

// ---- 5. ambiguous ----

test("two manifest articles with one title stop the run with nothing written", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  await createArticle(yt.transport, meta, WRITER);
  await createArticle(yt.transport, meta, WRITER);
  yt.calls.length = 0;

  const receipt = await run(plan, yt, github);
  assert.equal(receipt.result, "stopped");
  assert.equal(receipt.stores["romdex-metadata"].result, "different-content");
  assert.match(receipt.stores["romdex-metadata"].reason, /Several articles/);
  assert.equal(receipt.stores.npcdex.result, "not-created");
  assert.equal(yt.posts().length, 0);
  assert.equal(yt.articles.size, 2);
  assert.equal(yt.attachments.size, 0);
});

// ---- 6. half-finished ----

test("an article with the empty manifest is completed, not created again", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  const half = await createArticle(yt.transport, meta, WRITER);
  yt.calls.length = 0;

  const receipt = await run(plan, yt, github);
  assert.equal(receipt.result, "written");
  const creates = yt.calls.filter(
    (c) => c.method === "POST" && c.route.startsWith("articles?"),
  );
  assert.equal(creates.length, 1); // only NPCDex
  assert.equal(yt.articles.size, 2);
  assert.equal(receipt.stores["romdex-metadata"].created, false);
  assert.equal(receipt.stores["romdex-metadata"].article.id, half.id);
  assert.equal(receipt.stores["romdex-metadata"].result, "written");
  assert.equal(receipt.stores["romdex-metadata"].manifest.revision, 1);
  assert.equal(receipt.stores.npcdex.created, true);
});

// ---- 7. oversized ----

test("an oversized part throws before any request", async () => {
  const { plan, github } = await makePlan();
  const copy = structuredClone(plan);
  copy.npcdex.oversized.push({
    key: "root",
    name: "root.json.gz",
    size: 5_000_000,
  });
  const yt = fakeYouTrack();
  await assert.rejects(run(copy, yt, github), /over the 4,000,000-byte limit/);
  assert.equal(yt.calls.length, 0);
  assert.equal(github.calls.assertUnmoved, 0);
});

// ---- 8. head moved ----

test("a head that moved during the write rejects with HEAD_MOVED", async () => {
  const moved = Object.assign(new Error("main moved"), { code: "HEAD_MOVED" });
  const { plan, github } = await makePlan();
  github.calls.moved = moved;
  const yt = fakeYouTrack();
  await assert.rejects(run(plan, yt, github), { code: "HEAD_MOVED" });
  assert.equal(github.calls.assertUnmoved, 1);
  assert.equal(yt.articles.size, 2); // the write itself had happened
});

// ---- 9. verification failure ----

test("tampered bytes during verification reject the run", async () => {
  const { plan, github } = await makePlan();
  const yt = fakeYouTrack();
  yt.state.tamperEnabled = true;
  await assert.rejects(run(plan, yt, github), /SHA-256|wrong size/);
  assert.equal(github.calls.assertUnmoved, 0);
});
