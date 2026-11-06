import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import {
  buildPlan,
  formatReport,
  reportJson,
  SOURCE,
  TARGETS,
} from "./plan.mjs";
import {
  applyChanges,
  emptyMetadata,
  metadataHash,
  npcdexSummary,
  sha256Hex,
} from "./romdex-data.mjs";

const WS = SOURCE.workspace;
const PREFIX = `workspaces/${WS}/`;
const COMMIT = "c0ffee".repeat(6) + "c0ff";
const PNG_B64 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
).toString("base64");
const PNG_URL = `data:image/png;base64,${PNG_B64}`;
const PNG_SHA = sha256Hex(Buffer.from(PNG_B64, "base64"));

const objectPath = (sha) => `${PREFIX}objects/${sha.slice(0, 2)}/${sha}`;
const json = (value) => Buffer.from(JSON.stringify(value));
const record = (value) => {
  const bytes = json(value);
  return { id: sha256Hex(bytes), bytes };
};

// ---- fixture ----

function build() {
  const files = new Map();
  const put = (local, bytes) => files.set(PREFIX + local, bytes);
  const putObject = (bytes) => {
    const sha = sha256Hex(bytes);
    files.set(objectPath(sha), bytes);
    return sha;
  };
  const blob = (stored, extra, parts) => {
    const size = Math.ceil(stored.length / parts);
    const chunks = [];
    for (let at = 0; at < stored.length; at += size) {
      const piece = stored.subarray(at, at + size);
      chunks.push({ sha256: putObject(piece), bytes: piece.length });
    }
    return {
      sha256: sha256Hex(stored),
      bytes: stored.length,
      chunks,
      ...extra,
    };
  };
  const gz = (value, parts) => {
    const raw = json(value);
    return blob(
      gzipSync(raw),
      {
        codec: "gzip",
        expandedSha256: sha256Hex(raw),
        expandedBytes: raw.length,
      },
      parts,
    );
  };

  put(
    "bootstrap.json",
    json({ format: "ROMDexCloudBootstrap/1", workspaceId: WS }),
  );
  files.set("README.md", Buffer.from("# synthetic ROMDex-Data\n"));

  // metadata chain
  const g = record({
    format: "ROMDexMetadataGenesis/1",
    workspace: WS,
    parents: [],
    after: metadataHash(emptyMetadata()),
  });
  put(
    "romdex-metadata/genesis.json",
    json({
      format: "ROMDexMetadataRoot/1",
      workspace: WS,
      record: g.id,
    }),
  );
  put(`romdex-metadata/records/${g.id}.json`, g.bytes);
  let doc = emptyMetadata();
  let prev = g.id;
  const edits = [
    [
      {
        field: "orders",
        key: "ROOT",
        before: null,
        after: ["PMON-2", "PMON-1"],
      },
      {
        field: "assigned",
        key: "PMON-2",
        before: null,
        after: "In Development",
      },
    ],
    [
      { field: "assigned", key: "PMON-1", before: null, after: "Done" },
      { field: "images", key: "img1", before: null, after: PNG_URL },
    ],
    [
      {
        field: "assigned",
        key: "PMON-2",
        before: "In Development",
        after: null,
      },
    ],
  ];
  edits.forEach((changes, i) => {
    const next = applyChanges(doc, changes);
    const r = record({
      format: "ROMDexMetadataChange/1",
      workspace: WS,
      namespace: "romdex-metadata",
      sequence: i + 1,
      kind: "edit",
      parents: [prev],
      base: prev,
      before: metadataHash(doc),
      after: metadataHash(next),
      payload: gz(changes, i === 1 ? 2 : 1),
    });
    put(`romdex-metadata/records/${r.id}.json`, r.bytes);
    doc = next;
    prev = r.id;
  });

  // NPCDex
  const npcdexDoc = {
    version: 2,
    revision: 4,
    towns: [
      {
        id: "town-a",
        name: "A",
        characters: [{ id: 1, portrait: PNG_URL }, { id: 2 }],
        areas: [
          {
            elements: [
              { points: [{ blocks: [1, 2, 3] }, { blocks: [4] }] },
              { points: [{ blocks: [] }] },
            ],
          },
        ],
      },
      {
        id: "town-b",
        name: "B",
        characters: [],
        areas: [{ elements: [{ points: [{ blocks: [5, 6] }] }] }],
      },
    ],
    annotations: { a1: { image: PNG_URL, note: "hi" } },
    changePlans: { p1: {}, p2: {} },
    history: [{ at: 1 }, { at: 2 }],
  };
  const text = JSON.stringify(npcdexDoc);
  const current = {
    name: "npcdex-current.json",
    ...blob(Buffer.from(text), { codec: "raw-utf8" }, 2),
  };
  const draft = {
    name: "npcdex-recovery-draft.json",
    ...blob(Buffer.from("null"), { codec: "raw-utf8" }, 1),
  };
  const imp = record({
    format: "ROMDexNPCDexImport/1",
    workspace: WS,
    createdAt: "2026-10-16T00:00:00Z",
    parents: [],
    documents: [current, draft],
    summary: npcdexSummary(npcdexDoc),
  });
  const npcSha = sha256Hex(Buffer.from(text));
  put(
    "npcdex/genesis.json",
    json({
      format: "ROMDexNPCDexGenesis/1",
      workspace: WS,
      record: imp.id,
    }),
  );
  put(`npcdex/records/${imp.id}.json`, imp.bytes);
  put(
    "npcdex/retired-provider.json",
    json({
      format: "ROMDexRetiredNPCDexProvider/1",
      workspace: WS,
      retiredAt: "2026-10-18",
      authority: { registryIssueId: "3-376" },
      acceptedSourceSHA256: npcSha,
      acceptedSourceHead: imp.id,
    }),
  );

  return {
    files,
    npcdex: { sha256: npcSha, bytes: Buffer.byteLength(text) },
    bootstrapSha256: sha256Hex(files.get(PREFIX + "bootstrap.json")),
    putObject,
    head: prev,
    npcdexRecord: imp.id,
  };
}

function fakeSource(files, { moved = null } = {}) {
  const calls = { assertUnmoved: 0 };
  return {
    calls,
    stats: {
      requests: 3,
      cacheHits: 0,
      downloads: files.size,
      downloadedBytes: 1,
    },
    async pin() {
      return {
        commit: COMMIT,
        tree: "tree123",
        committedAt: "2026-11-01T00:00:00Z",
        files: new Map(
          [...files].map(([p, b]) => [
            p,
            { sha: "g" + p.length, size: b.length },
          ]),
        ),
      };
    },
    async readMany(paths) {
      return new Map(paths.map((p) => [p, files.get(p)]));
    },
    async readBlob(p) {
      return files.get(p);
    },
    async assertUnmoved() {
      calls.assertUnmoved += 1;
      if (moved) throw moved;
    },
  };
}

const original = {
  bootstrapSha256: SOURCE.bootstrapSha256,
  npcdex: SOURCE.npcdex,
};
let fx;
before(() => {
  fx = build();
  SOURCE.bootstrapSha256 = fx.bootstrapSha256;
  SOURCE.npcdex = fx.npcdex;
});
after(() => {
  SOURCE.bootstrapSha256 = original.bootstrapSha256;
  SOURCE.npcdex = original.npcdex;
});

const plan = (mutate, opts = {}) => {
  const files = new Map(fx.files);
  mutate?.(files);
  const source = fakeSource(files, opts);
  return { source, run: (o = {}) => buildPlan({ source, ...o }) };
};

// ---- happy path ----

test("buildPlan verifies and splits both stores", async () => {
  const { source, run } = plan();
  const lines = [];
  const p = await run({ log: (l) => lines.push(l) });

  assert.ok(lines.length > 0);
  assert.equal(source.calls.assertUnmoved, 1);
  assert.equal(p.target, "production");
  assert.equal(p.source.commit, COMMIT);
  assert.equal(p.source.headUnchanged, true);
  assert.equal(p.source.objects, p.source.objectsUsed);
  assert.deepEqual(p.source.unusedObjects, []);
  assert.deepEqual(p.source.otherFiles, ["README.md"]);

  assert.equal(p.metadata.verified.versionsVerified, 3);
  assert.equal(p.metadata.verified.head, fx.head);
  assert.deepEqual(p.metadata.parts.map((x) => x.key).sort(), [
    "assigned",
    "image/img1",
    "orders",
  ]);
  assert.equal(p.metadata.article, TARGETS.production.metadata);

  const keys = p.npcdex.parts.map((x) => x.key);
  for (const k of [
    "root",
    "town/town-a",
    "town/town-b",
    "annotations",
    "plans",
    "history",
    `image/${PNG_SHA}`,
  ]) {
    assert.ok(keys.includes(k), `missing part ${k}`);
  }
  assert.equal(keys.length, 7);
  assert.equal(p.npcdex.verified.images, 1);
  assert.equal(p.npcdex.verified.imageRefs, 2);
  assert.equal(p.npcdex.verified.retired.registryIssueId, "3-376");
  assert.equal(p.npcdex.verified.record, fx.npcdexRecord);

  assert.deepEqual(p.metadata.oversized, []);
  assert.deepEqual(p.npcdex.oversized, []);

  for (const [store, head, sha] of [
    [p.metadata, fx.head, p.metadata.verified.canonicalSha256],
    [p.npcdex, fx.npcdexRecord, fx.npcdex.sha256],
  ]) {
    const m = store.manifest;
    assert.equal(m.format, "romdex-store");
    assert.equal(m.store, store.store);
    assert.equal(m.revision, 1);
    assert.deepEqual(m.source, {
      repo: SOURCE.repo,
      commit: COMMIT,
      head,
      sha256: sha,
    });
    assert.equal(Object.keys(m.files).length, store.parts.length);
    for (const entry of Object.values(m.files)) {
      assert.equal(entry.where, "youtrack");
      assert.equal(entry.id, null);
    }
  }
});

test("target test uses the TST titles", async () => {
  const p = await plan().run({ target: "test" });
  assert.equal(p.metadata.article.title, "ROMDex data (test)");
  assert.equal(p.npcdex.article.title, "NPCDex data (test)");
  assert.equal(p.metadata.article.project, "TST");
  assert.equal(p.npcdex.article.project, "TST");
});

test("an unused valid object is reported and does not fail", async () => {
  const extra = Buffer.from("orphan");
  const sha = sha256Hex(extra);
  const p = await plan((files) => files.set(objectPath(sha), extra)).run();
  assert.deepEqual(p.source.unusedObjects, [sha]);
  assert.equal(p.source.objects, p.source.objectsUsed + 1);
});

// ---- reports ----

test("formatReport and reportJson", async () => {
  const p = await plan().run();
  const text = formatReport(p);
  assert.match(text, /DRY RUN/);
  assert.ok(text.includes(p.metadata.article.title));
  assert.ok(text.includes(p.npcdex.article.title));
  for (const part of [...p.metadata.parts, ...p.npcdex.parts]) {
    assert.ok(text.includes(part.name), `report lacks ${part.name}`);
  }

  const raw = reportJson(p);
  const parsed = JSON.parse(raw);
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        assert.notEqual(k, "encoded");
        assert.notEqual(typeof x === "object" ? k : "", "bytes");
        walk(x);
      }
    }
  };
  walk(parsed);
  assert.equal(parsed.metadata.parts.length, p.metadata.parts.length);
  assert.ok(!raw.includes('"type": "Buffer"'));
});

// ---- failures ----

test("an object whose bytes do not match its name fails", async () => {
  const victim = [...fx.files.keys()].find((k) => k.includes("/objects/"));
  await assert.rejects(
    plan((files) => files.set(victim, Buffer.from("tampered"))).run(),
    /does not match its name/,
  );
});

test("an unexpected file in the workspace fails", async () => {
  await assert.rejects(
    plan((files) => files.set(`${PREFIX}surprise.txt`, Buffer.from("x"))).run(),
    /Unexpected file in ROMDex-Data: .*surprise\.txt/,
  );
});

test("a missing npcdex/genesis.json fails", async () => {
  await assert.rejects(
    plan((files) => files.delete(`${PREFIX}npcdex/genesis.json`)).run(),
    /missing .*npcdex\/genesis\.json/,
  );
});

test("a bootstrap with different bytes fails", async () => {
  await assert.rejects(
    plan((files) =>
      files.set(
        `${PREFIX}bootstrap.json`,
        json({ format: "ROMDexCloudBootstrap/1", workspaceId: WS, extra: 1 }),
      ),
    ).run(),
    /bootstrap\.json sha256 mismatch/,
  );
});

test("a moved head rejects with HEAD_MOVED", async () => {
  const moved = Object.assign(new Error("main moved"), { code: "HEAD_MOVED" });
  await assert.rejects(plan(null, { moved }).run(), { code: "HEAD_MOVED" });
});

test("an unknown target fails", async () => {
  await assert.rejects(
    plan().run({ target: "staging" }),
    /Unknown target staging/,
  );
});
