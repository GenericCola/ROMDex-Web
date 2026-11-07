import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  applyChanges,
  assembleBlob,
  canonicalMetadata,
  checkBootstrap,
  emptyMetadata,
  loadMetadata,
  loadNpcdex,
  metadataHash,
  npcdexSummary,
  sha256Hex,
} from "./romdex-data.mjs";

const WS = "ws-1";

function makeStore() {
  const objects = new Map();
  return {
    objects,
    readObject: async (sha) => {
      if (!objects.has(sha)) throw new Error(`missing object ${sha}`);
      return objects.get(sha);
    },
  };
}

// Stores `stored` split into `parts` chunks and returns the blob descriptor.
function putBlob(store, stored, extra, parts = 1) {
  const size = Math.ceil(stored.length / parts);
  const chunks = [];
  for (let at = 0; at < stored.length; at += size) {
    const piece = stored.subarray(at, at + size);
    const sha256 = sha256Hex(piece);
    store.objects.set(sha256, piece);
    chunks.push({ sha256, bytes: piece.length });
  }
  return { sha256: sha256Hex(stored), bytes: stored.length, chunks, ...extra };
}

function gzipPayload(store, value, parts = 2) {
  const json = Buffer.from(JSON.stringify(value));
  return putBlob(
    store,
    gzipSync(json),
    {
      codec: "gzip",
      expandedSha256: sha256Hex(json),
      expandedBytes: json.length,
    },
    parts,
  );
}

function rawPayload(store, text, parts = 1) {
  return putBlob(store, Buffer.from(text), { codec: "raw-utf8" }, parts);
}

function makeRecord(object) {
  const bytes = Buffer.from(JSON.stringify(object));
  return { id: sha256Hex(bytes), bytes };
}

function genesisRecord() {
  return makeRecord({
    format: "ROMDexMetadataGenesis/1",
    workspace: WS,
    parents: [],
    after: metadataHash(emptyMetadata()),
  });
}

// Builds a change record on top of `baseDoc`; overrides allow corrupting fields.
function changeRecord(
  store,
  { baseId, baseDoc, parents, changes, kind = "edit", seq = 1, ...override },
) {
  const after = applyChanges(baseDoc, changes);
  return makeRecord({
    format: "ROMDexMetadataChange/1",
    workspace: WS,
    namespace: "romdex-metadata",
    sequence: seq,
    kind,
    parents: parents ?? [baseId],
    base: baseId,
    before: metadataHash(baseDoc),
    after: metadataHash(after),
    payload: gzipPayload(store, changes),
    ...override,
  });
}

// genesis + 3 edits (set, set, remove)
function linearChain() {
  const store = makeStore();
  const g = genesisRecord();
  const d0 = emptyMetadata();
  const c1 = [
    { field: "orders", key: "ROOT", before: null, after: ["PMON-2", "PMON-1"] },
    { field: "assigned", key: "PMON-2", before: null, after: "In Development" },
  ];
  const r1 = changeRecord(store, {
    baseId: g.id,
    baseDoc: d0,
    changes: c1,
    seq: 1,
  });
  const d1 = applyChanges(d0, c1);
  const c2 = [
    { field: "assigned", key: "PMON-1", before: null, after: "Done" },
  ];
  const r2 = changeRecord(store, {
    baseId: r1.id,
    baseDoc: d1,
    changes: c2,
    seq: 2,
  });
  const d2 = applyChanges(d1, c2);
  const c3 = [
    { field: "assigned", key: "PMON-2", before: "In Development", after: null },
  ];
  const r3 = changeRecord(store, {
    baseId: r2.id,
    baseDoc: d2,
    changes: c3,
    seq: 3,
  });
  const d3 = applyChanges(d2, c3);
  const records = new Map([g, r1, r2, r3].map((r) => [r.id, r.bytes]));
  return { store, g, r1, r2, r3, d1, d2, d3, records };
}

function genesisFile(g) {
  return { format: "ROMDexMetadataRoot/1", workspace: WS, record: g.id };
}

function load(chain, records = chain.records, extra = {}) {
  return loadMetadata({
    workspace: WS,
    genesis: genesisFile(chain.g),
    records,
    readObject: chain.store.readObject,
    ...extra,
  });
}

test("empty metadata hash and canonical form", () => {
  assert.equal(
    metadataHash(emptyMetadata()),
    "0a7d1ce169eee6e712d6b0c3fc8f2bf20ef8daef745d93f9725128a07120447c",
  );
  const doc = {
    version: 2,
    authorizations: { b: 1 },
    assigned: { z: 1, a: 2 },
    orders: {},
    images: {},
    extra: 1,
  };
  const canon = canonicalMetadata(doc);
  assert.deepEqual(Object.keys(canon), [
    "version",
    "images",
    "orders",
    "assigned",
    "authorizations",
  ]);
  assert.deepEqual(Object.keys(canon.assigned), ["a", "z"]);
  assert.deepEqual(Object.keys(canonicalMetadata({ version: 1 })), [
    "version",
    "images",
    "orders",
    "assigned",
  ]);
  assert.equal(Object.keys(canonicalMetadata({ version: 5 })).length, 8);
});

test("applyChanges is pure and checks field and before", () => {
  const doc = emptyMetadata();
  const next = applyChanges(doc, [
    { field: "assigned", key: "A", before: null, after: "x" },
  ]);
  assert.deepEqual(doc.assigned, {});
  assert.deepEqual(next.assigned, { A: "x" });
  assert.throws(
    () =>
      applyChanges(doc, [
        { field: "testing", key: "A", before: null, after: 1 },
      ]),
    /unsupported field/,
  );
  assert.throws(
    () =>
      applyChanges(next, [
        { field: "assigned", key: "A", before: "y", after: "z" },
      ]),
    /assigned\/A/,
  );
});

test("checkBootstrap", () => {
  const bytes = Buffer.from(
    JSON.stringify({ format: "ROMDexCloudBootstrap/1", workspaceId: WS }),
  );
  const sha256 = sha256Hex(bytes);
  assert.equal(
    checkBootstrap(bytes, { sha256, workspace: WS }).workspaceId,
    WS,
  );
  assert.throws(
    () => checkBootstrap(bytes, { sha256: "00", workspace: WS }),
    /sha256 mismatch/,
  );
  assert.throws(
    () => checkBootstrap(bytes, { sha256, workspace: "other" }),
    /workspaceId/,
  );
  const bad = Buffer.from(JSON.stringify({ format: "x", workspaceId: WS }));
  assert.throws(
    () => checkBootstrap(bad, { sha256: sha256Hex(bad), workspace: WS }),
    /format/,
  );
});

test("assembleBlob happy paths", async () => {
  const store = makeStore();
  const gz = gzipPayload(store, { a: 1, b: "x".repeat(200) }, 3);
  const out = await assembleBlob(gz, store.readObject, { label: "gz" });
  assert.deepEqual(JSON.parse(out.bytes), { a: 1, b: "x".repeat(200) });
  assert.equal(out.stored, gz.bytes);
  assert.equal(out.objects.length, gz.chunks.length);
  assert.ok(gz.chunks.length >= 2);

  const raw = rawPayload(store, "hello world", 2);
  const rawOut = await assembleBlob(raw, store.readObject, { label: "raw" });
  assert.equal(rawOut.bytes.toString(), "hello world");
  assert.equal(rawOut.stored, 11);
});

test("assembleBlob failures", async () => {
  const store = makeStore();
  const good = gzipPayload(store, { a: 1 }, 2);
  const read = store.readObject;
  const run = (d, r = read) => assembleBlob(d, r, { label: "t" });

  const swapped = (sha) => async (s) =>
    s === sha ? Buffer.from("tampered!") : read(s);
  await assert.rejects(
    run(good, swapped(good.chunks[0].sha256)),
    /chunk .* hashes to/,
  );

  const badLen = structuredClone(good);
  badLen.chunks[0].bytes += 1;
  await assert.rejects(run(badLen), /bytes, expected/);

  await assert.rejects(
    run({ ...good, sha256: "0".repeat(64) }),
    /stored sha256/,
  );
  await assert.rejects(
    run({ ...good, bytes: good.bytes + 1 }),
    /stored length/,
  );
  await assert.rejects(
    run({ ...good, expandedSha256: "0".repeat(64) }),
    /expanded sha256/,
  );
  await assert.rejects(run({ ...good, expandedBytes: 1 }), /expanded length/);

  const notGzip = putBlob(store, Buffer.from("plain text"), {
    codec: "gzip",
    expandedSha256: "",
    expandedBytes: 0,
  });
  await assert.rejects(run(notGzip), /gzip magic/);
  await assert.rejects(run({ ...good, codec: "zstd" }), /unknown codec zstd/);
});

test("loadMetadata rebuilds a linear chain", async () => {
  const c = linearChain();
  const out = await load(c);
  assert.equal(out.genesisId, c.g.id);
  assert.equal(out.head, c.r3.id);
  assert.equal(out.headRecord.sequence, 3);
  assert.equal(out.records, 4);
  assert.deepEqual(out.edits, { edit: 3, merge: 0, resolution: 0 });
  assert.equal(out.versionsVerified, 3);
  assert.equal(out.objects, 6);
  assert.ok(out.payloadBytes > 0);
  assert.deepEqual(out.document, canonicalMetadata(c.d3));
  assert.deepEqual(out.document.assigned, { "PMON-1": "Done" });
  assert.equal(out.sha256, metadataHash(c.d3));
  assert.equal(out.sha256, JSON.parse(c.records.get(c.r3.id)).after);
});

test("loadMetadata with only the genesis", async () => {
  const store = makeStore();
  const g = genesisRecord();
  const out = await loadMetadata({
    workspace: WS,
    genesis: genesisFile(g),
    records: new Map([[g.id, g.bytes]]),
    readObject: store.readObject,
  });
  assert.equal(out.head, g.id);
  assert.equal(out.versionsVerified, 0);
});

test("loadMetadata rejects bad records", async () => {
  const c = linearChain();
  const tamper = (id, fn) => {
    const copy = new Map(c.records);
    const obj = JSON.parse(copy.get(id));
    fn(obj);
    copy.set(id, Buffer.from(JSON.stringify(obj)));
    return copy;
  };

  // bytes no longer match the id
  await assert.rejects(
    load(
      c,
      tamper(c.r2.id, (o) => (o.sequence = 99)),
    ),
    /hashes to/,
  );

  // re-keyed under its new hash, so the id check passes and the chain check fires
  const rekey = (id, fn) => {
    const copy = tamper(id, fn);
    const bytes = copy.get(id);
    copy.delete(id);
    return { copy, newId: sha256Hex(bytes), bytes };
  };
  const withTail = (id, fn) => {
    // change r3 (the head), so no later record needs re-pointing
    const { copy, newId, bytes } = rekey(id, fn);
    copy.set(newId, bytes);
    return copy;
  };
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.after = "0".repeat(64))),
    ),
    /after is 0{64}/,
  );
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.before = "0".repeat(64))),
    ),
    /before is 0{64}/,
  );
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.parents = ["f".repeat(64)])),
    ),
    /missing parent/,
  );
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.base = c.r1.id)),
    ),
    /not one of its parents/,
  );
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.kind = "weird")),
    ),
    /kind weird/,
  );
  await assert.rejects(
    load(
      c,
      withTail(c.r3.id, (o) => (o.namespace = "npcdex")),
    ),
    /namespace/,
  );
});

test("loadMetadata rejects a change whose before does not match the current value", async () => {
  const c = linearChain();
  const wrong = [
    { field: "assigned", key: "PMON-1", before: "Todo", after: "Done" },
  ];
  // Record is internally consistent (hashes come from a correct change), but the payload lies.
  const good = [
    { field: "assigned", key: "PMON-1", before: "Done", after: "Blocked" },
  ];
  const r4 = changeRecord(c.store, {
    baseId: c.r3.id,
    baseDoc: c.d3,
    changes: good,
    seq: 4,
  });
  const bad = JSON.parse(r4.bytes);
  bad.payload = gzipPayload(c.store, wrong);
  const badBytes = Buffer.from(JSON.stringify(bad));
  const records = new Map(c.records);
  records.set(sha256Hex(badBytes), badBytes);
  await assert.rejects(load(c, records), /assigned\/PMON-1/);
});

test("loadMetadata reports multiple heads", async () => {
  const c = linearChain();
  const sibling = changeRecord(c.store, {
    baseId: c.r2.id,
    baseDoc: c.d2,
    changes: [
      { field: "assigned", key: "PMON-9", before: null, after: "Todo" },
    ],
    seq: 4,
  });
  const records = new Map(c.records);
  records.set(sibling.id, sibling.bytes);
  await assert.rejects(load(c, records), (error) => {
    assert.equal(error.code, "MULTIPLE_HEADS");
    assert.match(error.message, /desktop app/);
    assert.ok(
      error.message.includes(c.r3.id) && error.message.includes(sibling.id),
    );
    return true;
  });
});

test("loadMetadata applies a merge record on its base", async () => {
  const c = linearChain();
  const sibling = changeRecord(c.store, {
    baseId: c.r2.id,
    baseDoc: c.d2,
    changes: [
      { field: "assigned", key: "PMON-9", before: null, after: "Todo" },
    ],
    seq: 4,
  });
  // merge follows both heads, bases on r3 and adds the sibling's change
  const mergeChanges = [
    { field: "assigned", key: "PMON-9", before: null, after: "Todo" },
  ];
  const merge = changeRecord(c.store, {
    baseId: c.r3.id,
    baseDoc: c.d3,
    parents: [c.r3.id, sibling.id],
    changes: mergeChanges,
    kind: "merge",
    seq: 5,
  });
  const records = new Map(c.records);
  records.set(sibling.id, sibling.bytes);
  records.set(merge.id, merge.bytes);
  const out = await load(c, records);
  assert.equal(out.head, merge.id);
  assert.deepEqual(out.edits, { edit: 4, merge: 1, resolution: 0 });
  assert.deepEqual(out.document.assigned, {
    "PMON-1": "Done",
    "PMON-9": "Todo",
  });
});

test("loadMetadata detects a cycle", async () => {
  // Real ids are content hashes, so two records cannot name each other. The
  // optional `hash` argument lets the test use ids carried inside the record.
  const g = genesisRecord();
  const a = Buffer.from(
    JSON.stringify({
      id: "A",
      format: "ROMDexMetadataChange/1",
      workspace: WS,
      namespace: "romdex-metadata",
      kind: "edit",
      parents: ["B"],
      base: "B",
    }),
  );
  const b = Buffer.from(
    JSON.stringify({
      id: "B",
      format: "ROMDexMetadataChange/1",
      workspace: WS,
      namespace: "romdex-metadata",
      kind: "edit",
      parents: ["A"],
      base: "A",
    }),
  );
  const fakeHash = (bytes) => {
    const parsed = JSON.parse(bytes);
    return parsed.id ?? sha256Hex(bytes);
  };
  await assert.rejects(
    loadMetadata({
      workspace: WS,
      genesis: genesisFile(g),
      records: new Map([
        [g.id, g.bytes],
        ["A", a],
        ["B", b],
      ]),
      readObject: makeStore().readObject,
      hash: fakeHash,
    }),
    /cycle/,
  );
});

// ---------- NPCDex ----------

const PNG = Buffer.from("not really a png").toString("base64");

function npcdexDoc() {
  return {
    version: 2,
    revision: 7,
    towns: [
      {
        name: "A",
        characters: [{ id: 1 }, { id: 2 }],
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
        name: "B",
        characters: [],
        areas: [{ elements: [{ points: [{ blocks: [5, 6] }] }] }],
      },
    ],
    changePlans: { p1: {}, p2: {} },
    annotations: { a1: { image: `data:image/png;base64,${PNG}` } },
    history: [{}, {}, {}],
    implementationReceipts: [{}],
    changeRequests: [],
  };
}

function npcdexFixture({ summaryPatch = {}, draft = "null", text } = {}) {
  const store = makeStore();
  const doc = npcdexDoc();
  const currentText = text ?? JSON.stringify(doc);
  const current = {
    name: "npcdex-current.json",
    ...rawPayload(store, currentText, 2),
  };
  const recovery = {
    name: "npcdex-recovery-draft.json",
    ...rawPayload(store, draft),
  };
  const record = makeRecord({
    format: "ROMDexNPCDexImport/1",
    workspace: WS,
    createdAt: "2026-10-16T00:00:00Z",
    parents: [],
    documents: [current, recovery],
    summary: { ...npcdexSummary(doc), ...summaryPatch },
  });
  const sha256 = sha256Hex(Buffer.from(currentText));
  return {
    store,
    record,
    expect: { sha256, bytes: Buffer.byteLength(currentText) },
    genesis: {
      format: "ROMDexNPCDexGenesis/1",
      workspace: WS,
      record: record.id,
    },
    retired: {
      format: "ROMDexRetiredNPCDexProvider/1",
      workspace: WS,
      retiredAt: "2026-10-18",
      authority: { registryIssueId: "3-376" },
      acceptedSourceSHA256: sha256,
      acceptedSourceHead: record.id,
    },
  };
}

function loadN(f, over = {}) {
  return loadNpcdex({
    workspace: WS,
    genesis: f.genesis,
    records: new Map([[f.record.id, f.record.bytes]]),
    retired: f.retired,
    readObject: f.store.readObject,
    expect: f.expect,
    ...over,
  });
}

test("npcdexSummary counts", () => {
  const imageBytes = Buffer.from(PNG, "base64").length;
  assert.deepEqual(npcdexSummary(npcdexDoc()), {
    revision: 7,
    towns: 2,
    areas: 2,
    elements: 3,
    points: 4,
    blocks: 6,
    characters: 2,
    plans: 2,
    history: 3,
    receipts: 1,
    requests: 0,
    annotations: 1,
    embeddedImages: 1,
    imageBytes,
  });
  assert.equal(npcdexSummary({}).towns, 0);
});

test("loadNpcdex happy path", async () => {
  const f = npcdexFixture();
  const out = await loadN(f);
  assert.equal(out.recordId, f.record.id);
  assert.equal(out.createdAt, "2026-10-16T00:00:00Z");
  assert.equal(out.sha256, f.expect.sha256);
  assert.equal(out.bytes.length, f.expect.bytes);
  assert.equal(out.document.revision, 7);
  assert.equal(out.summary.embeddedImages, 1);
  assert.equal(out.recoveryDraft, "null");
  assert.deepEqual(out.warnings, []);
  assert.equal(out.objects, 3);
  assert.deepEqual(out.retired, {
    retiredAt: "2026-10-18",
    registryIssueId: "3-376",
  });
  assert.equal((await loadN(f, { retired: undefined })).retired, null);
});

test("loadNpcdex failures", async () => {
  const f = npcdexFixture();
  await assert.rejects(
    loadN(f, { expect: { ...f.expect, sha256: "0".repeat(64) } }),
    /sha256 is/,
  );
  await assert.rejects(
    loadN(f, { expect: { ...f.expect, bytes: 1 } }),
    /bytes, expected 1/,
  );

  const pretty = npcdexFixture({ text: JSON.stringify(npcdexDoc(), null, 2) });
  await assert.rejects(loadN(pretty), /byte-exact/);

  const wrongSummary = npcdexFixture({ summaryPatch: { towns: 9, blocks: 0 } });
  await assert.rejects(loadN(wrongSummary), /summary mismatch.*towns.*blocks/);

  await assert.rejects(
    loadN(f, {
      retired: { ...f.retired, acceptedSourceSHA256: "1".repeat(64) },
    }),
    /acceptedSourceSHA256/,
  );
  await assert.rejects(
    loadN(f, { retired: { ...f.retired, acceptedSourceHead: "x" } }),
    /acceptedSourceHead/,
  );

  const extra = makeRecord({ format: "ROMDexNPCDexChange/1", workspace: WS });
  await assert.rejects(
    loadN(f, {
      records: new Map([
        [f.record.id, f.record.bytes],
        [extra.id, extra.bytes],
      ]),
    }),
    /not supported/,
  );
  await assert.rejects(
    loadN(f, { genesis: { ...f.genesis, record: "x" } }),
    /genesis.json names/,
  );
});

test("loadNpcdex warns about a recovery draft that is not null", async () => {
  const f = npcdexFixture({ draft: '{"x":1}' });
  const out = await loadN(f);
  assert.equal(out.recoveryDraft, '{"x":1}');
  assert.equal(out.warnings.length, 1);
  assert.match(out.warnings[0], /recovery draft/);
});
