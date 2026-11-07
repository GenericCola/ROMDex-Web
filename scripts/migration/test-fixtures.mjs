// Shared synthetic ROMDex-Data fixture for the migration tests. Not a test file:
// the test glob is scripts/migration/*.test.mjs.
import { after, before } from "node:test";
import { gzipSync } from "node:zlib";
import { SOURCE } from "./plan.mjs";
import {
  applyChanges,
  emptyMetadata,
  metadataHash,
  npcdexSummary,
  sha256Hex,
} from "./romdex-data.mjs";

export const WS = SOURCE.workspace;
export const PREFIX = `workspaces/${WS}/`;
export const COMMIT = "c0ffee".repeat(6) + "c0ff";
const PNG_B64 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
).toString("base64");
export const PNG_URL = `data:image/png;base64,${PNG_B64}`;
export const PNG_SHA = sha256Hex(Buffer.from(PNG_B64, "base64"));

export const objectPath = (sha) => `${PREFIX}objects/${sha.slice(0, 2)}/${sha}`;
export const json = (value) => Buffer.from(JSON.stringify(value));
export const record = (value) => {
  const bytes = json(value);
  return { id: sha256Hex(bytes), bytes };
};

// The first two metadata edits every synthetic chain starts with.
export const BASE_EDITS = [
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
];

// Builds the files of a synthetic ROMDex-Data workspace: bootstrap, a metadata
// chain of `edits` (payload split into `partsFor(i)` chunks) and an NPCDex import
// of `npcdexDoc` (stored in two chunks).
export function buildSynthetic({
  edits,
  npcdexDoc,
  partsFor = () => 1,
  readme = false,
}) {
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
  if (readme) files.set("README.md", Buffer.from("# synthetic ROMDex-Data\n"));

  // metadata chain
  const g = record({
    format: "ROMDexMetadataGenesis/1",
    workspace: WS,
    parents: [],
    after: metadataHash(emptyMetadata()),
  });
  put(
    "romdex-metadata/genesis.json",
    json({ format: "ROMDexMetadataRoot/1", workspace: WS, record: g.id }),
  );
  put(`romdex-metadata/records/${g.id}.json`, g.bytes);
  let doc = emptyMetadata();
  let prev = g.id;
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
      payload: gz(changes, partsFor(i)),
    });
    put(`romdex-metadata/records/${r.id}.json`, r.bytes);
    doc = next;
    prev = r.id;
  });

  // NPCDex
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
    json({ format: "ROMDexNPCDexGenesis/1", workspace: WS, record: imp.id }),
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

// A GitHub source double over `files`. `moved` is the error assertUnmoved throws.
export function fakeSource(files, { moved = null, requests = 1 } = {}) {
  const calls = { assertUnmoved: 0, moved };
  return {
    calls,
    stats: {
      requests,
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
      if (calls.moved) throw calls.moved;
    },
  };
}

// Builds the fixture before the tests and points SOURCE at it until they end.
// Returns a getter for the built fixture.
export function useSyntheticFixture(buildOptions) {
  const original = {
    bootstrapSha256: SOURCE.bootstrapSha256,
    npcdex: SOURCE.npcdex,
  };
  let fx;
  before(() => {
    fx = buildSynthetic(buildOptions);
    SOURCE.bootstrapSha256 = fx.bootstrapSha256;
    SOURCE.npcdex = fx.npcdex;
  });
  after(() => {
    SOURCE.bootstrapSha256 = original.bootstrapSha256;
    SOURCE.npcdex = original.npcdex;
  });
  return () => fx;
}
