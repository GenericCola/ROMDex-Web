// Builds the migration plan: read ROMDex-Data at one pinned commit, verify it,
// rebuild both documents, split them into store parts and draft the manifests.
// Pure apart from the `source` it is given (see github-source.mjs), so the later
// write step can take the plan as is.
import {
  decodePart,
  encodePart,
  joinMetadata,
  joinNpcdex,
  MAX_PART_BYTES,
  oversized,
  splitMetadata,
  splitNpcdex,
} from "./parts.mjs";
import {
  checkBootstrap,
  loadMetadata,
  loadNpcdex,
  metadataHash,
  sha256Hex,
} from "./romdex-data.mjs";

export const SOURCE = {
  repo: "GenericCola/ROMDex-Data",
  branch: "main",
  workspace: "1e267c45-75ae-48a9-b173-5ca3132bb121",
  bootstrapSha256:
    "e47be8ff64715f5473289f1d1e336c4d7b512644660667e1b1ff1dd639bb25c4",
  npcdex: {
    sha256: "2c50ee40f590eb1505a99922efa948db282fe46425bf640b5a0f69fc780c630c",
    bytes: 9_915_298,
  },
};

export const TARGETS = {
  production: {
    metadata: { project: "PMON", projectId: "0-1", title: "ROMDex data" },
    npcdex: { project: "NPCD", projectId: "0-2", title: "NPCDex data" },
  },
  test: {
    metadata: { project: "TST", title: "ROMDex data (test)" },
    npcdex: { project: "TST", title: "NPCDex data (test)" },
  },
};

const OBJECT_PATH = /^objects\/([0-9a-f]{2})\/([0-9a-f]{64})$/;
const RECORD_PATH = /^(romdex-metadata|npcdex)\/records\/([0-9a-f]{64})\.json$/;

const parseJson = (bytes, label) => {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
};

// Sorts the pinned tree into the files the migration knows. Anything else under
// the workspace is an error, so a format change in ROMDex-Data is never skipped.
const classify = (files, workspace) => {
  const prefix = `workspaces/${workspace}/`;
  const layout = {
    objects: new Map(),
    records: { "romdex-metadata": [], npcdex: [] },
    other: [],
  };
  const known = new Set([
    "bootstrap.json",
    "romdex-metadata/genesis.json",
    "npcdex/genesis.json",
    "npcdex/retired-provider.json",
  ]);
  for (const [path, entry] of files) {
    if (!path.startsWith(prefix)) {
      layout.other.push(path);
      continue;
    }
    const local = path.slice(prefix.length);
    const object = OBJECT_PATH.exec(local);
    const record = RECORD_PATH.exec(local);
    if (object && object[2].startsWith(object[1]))
      layout.objects.set(object[2], { path, size: entry.size });
    else if (record) layout.records[record[1]].push({ id: record[2], path });
    else if (!known.has(local))
      throw new Error(`Unexpected file in ROMDex-Data: ${path}`);
  }
  for (const name of known) {
    if (name !== "npcdex/retired-provider.json" && !files.has(prefix + name)) {
      throw new Error(`ROMDex-Data is missing ${prefix + name}`);
    }
  }
  return layout;
};

const describeParts = (encoded) =>
  encoded.map(function describe({
    key,
    name,
    codec,
    type,
    sha256,
    size,
    rawSize,
  }) {
    return {
      key,
      name,
      codec,
      ...(type ? { type } : {}),
      sha256,
      size,
      rawSize,
    };
  });

const draftManifest = ({ store, encoded, source }) => ({
  format: "romdex-store",
  version: 1,
  store,
  revision: 1,
  writtenAt: null,
  writtenBy: null,
  writeId: null,
  files: Object.fromEntries(
    encoded.map(function entry({ key, name, sha256, size, codec, type }) {
      return [
        key,
        {
          name,
          sha256,
          size,
          where: "youtrack",
          id: null,
          codec,
          ...(type ? { type } : {}),
        },
      ];
    }),
  ),
  source,
});

const storePlan = ({ store, target, encoded, source, extra }) => ({
  store,
  article: target,
  parts: describeParts(encoded),
  encoded,
  totals: {
    parts: encoded.length,
    stored: encoded.reduce((n, p) => n + p.size, 0),
    raw: encoded.reduce((n, p) => n + p.rawSize, 0),
    largest:
      describeParts(
        [...encoded].sort((a, b) => b.size - a.size).slice(0, 1),
      )[0] ?? null,
  },
  oversized: describeParts(oversized(encoded)),
  manifest: draftManifest({ store, encoded, source }),
  ...extra,
});

// Decodes every encoded part and joins it back, so the plan proves the split
// loses nothing before anything is uploaded.
const decodeAll = (encoded) => encoded.map(decodePart);

/**
 * @param {{ source: ReturnType<import("./github-source.mjs").createGitHubSource>, target?: "production" | "test", log?: (line: string) => void }} options
 */
export const buildPlan = async ({
  source,
  target = "production",
  log = () => {},
}) => {
  const articles = TARGETS[target];
  if (!articles) throw new Error(`Unknown target ${target}`);
  const startedAt = new Date().toISOString();

  const pinned = await source.pin();
  log(
    `Pinned ${SOURCE.repo} ${SOURCE.branch} at ${pinned.commit} (${pinned.files.size} files)`,
  );
  const layout = classify(pinned.files, SOURCE.workspace);
  const prefix = `workspaces/${SOURCE.workspace}/`;

  const blobs = await source.readMany(
    [...pinned.files.keys()].filter((p) => p.startsWith(prefix)),
  );
  log(
    `Read ${blobs.size} files (${source.stats.cacheHits} from cache, ${source.stats.downloads} downloaded)`,
  );
  const file = (local) => blobs.get(prefix + local);

  // Every object is named by the SHA-256 of its bytes; check them all, used or not.
  for (const [sha, { path }] of layout.objects) {
    if (sha256Hex(blobs.get(path)) !== sha)
      throw new Error(`Object ${path} does not match its name`);
  }
  const used = new Set();
  const readObject = async (sha) => {
    const entry = layout.objects.get(sha);
    if (!entry)
      throw new Error(
        `Object ${sha} is listed by a record but missing from ROMDex-Data`,
      );
    used.add(sha);
    return blobs.get(entry.path);
  };

  checkBootstrap(file("bootstrap.json"), {
    sha256: SOURCE.bootstrapSha256,
    workspace: SOURCE.workspace,
  });

  const recordMap = (namespace) =>
    new Map(
      layout.records[namespace].map(({ id, path }) => [id, blobs.get(path)]),
    );

  const metadata = await loadMetadata({
    workspace: SOURCE.workspace,
    genesis: parseJson(
      file("romdex-metadata/genesis.json"),
      "romdex-metadata/genesis.json",
    ),
    records: recordMap("romdex-metadata"),
    readObject,
  });
  log(
    `Metadata: ${metadata.versionsVerified} versions verified, head ${metadata.head}`,
  );

  const retiredBytes = file("npcdex/retired-provider.json");
  const npcdex = await loadNpcdex({
    workspace: SOURCE.workspace,
    genesis: parseJson(file("npcdex/genesis.json"), "npcdex/genesis.json"),
    records: recordMap("npcdex"),
    retired: retiredBytes
      ? parseJson(retiredBytes, "npcdex/retired-provider.json")
      : undefined,
    readObject,
    expect: SOURCE.npcdex,
  });
  log(`NPCDex: ${npcdex.bytes.length} bytes rebuilt, SHA-256 ${npcdex.sha256}`);

  const unused = [...layout.objects.keys()].filter((sha) => !used.has(sha));

  // Split, encode, then prove the round trip from the encoded bytes.
  const metadataEncoded = splitMetadata(metadata.document).map(encodePart);
  const metadataRejoined = metadataHash(
    joinMetadata(decodeAll(metadataEncoded)),
  );
  if (metadataRejoined !== metadata.sha256) {
    throw new Error(
      `Metadata parts rebuild to ${metadataRejoined}, expected ${metadata.sha256}`,
    );
  }
  const npcdexSplit = splitNpcdex(npcdex.document);
  const npcdexEncoded = npcdexSplit.parts.map(encodePart);
  const npcdexRejoined = sha256Hex(
    Buffer.from(JSON.stringify(joinNpcdex(decodeAll(npcdexEncoded)))),
  );
  if (npcdexRejoined !== npcdex.sha256) {
    throw new Error(
      `NPCDex parts rebuild to ${npcdexRejoined}, expected ${npcdex.sha256}`,
    );
  }

  // Last: the source must not have moved while we read it.
  await source.assertUnmoved();

  const sourceBase = { repo: SOURCE.repo, commit: pinned.commit };
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    target,
    maxPartBytes: MAX_PART_BYTES,
    source: {
      ...sourceBase,
      branch: SOURCE.branch,
      tree: pinned.tree,
      committedAt: pinned.committedAt,
      files: pinned.files.size,
      workspaceFiles: blobs.size,
      objects: layout.objects.size,
      objectsUsed: used.size,
      unusedObjects: unused,
      otherFiles: layout.other,
      headUnchanged: true,
      stats: { ...source.stats },
    },
    metadata: storePlan({
      store: "romdex-metadata",
      target: articles.metadata,
      encoded: metadataEncoded,
      source: { ...sourceBase, head: metadata.head, sha256: metadata.sha256 },
      extra: {
        verified: {
          records: metadata.records,
          kinds: metadata.edits,
          versionsVerified: metadata.versionsVerified,
          objects: metadata.objects,
          payloadBytes: metadata.payloadBytes,
          head: metadata.head,
          headSequence: metadata.headRecord.sequence,
          canonicalSha256: metadata.sha256,
          documentBytes: Buffer.byteLength(JSON.stringify(metadata.document)),
          counts: Object.fromEntries(
            Object.entries(metadata.document).map(function count([
              field,
              value,
            ]) {
              return [
                field,
                value && typeof value === "object"
                  ? Object.keys(value).length
                  : value,
              ];
            }),
          ),
          rejoinedSha256: metadataRejoined,
        },
      },
    }),
    npcdex: storePlan({
      store: "npcdex",
      target: articles.npcdex,
      encoded: npcdexEncoded,
      source: { ...sourceBase, head: npcdex.recordId, sha256: npcdex.sha256 },
      extra: {
        verified: {
          record: npcdex.recordId,
          createdAt: npcdex.createdAt,
          bytes: npcdex.bytes.length,
          sha256: npcdex.sha256,
          objects: npcdex.objects,
          summary: npcdex.summary,
          images: npcdexSplit.images,
          imageRefs: npcdexSplit.imageRefs,
          inlineImages: npcdexSplit.inlineImages,
          recoveryDraft: npcdex.recoveryDraft,
          warnings: npcdex.warnings,
          retired: npcdex.retired,
          rejoinedSha256: npcdexRejoined,
        },
      },
    }),
  };
};

const kb = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KiB`
      : `${(n / 1024 / 1024).toFixed(2)} MiB`;

const partLines = (store) =>
  store.parts.map(function line(p) {
    const flag = p.size > MAX_PART_BYTES ? "  OVER 4,000,000 BYTES" : "";
    return `    ${p.key.padEnd(30)} ${String(p.size).padStart(9)} B stored  ${String(p.rawSize).padStart(9)} B raw  ${p.sha256}  ${p.name}${flag}`;
  });

const storeSection = (title, store) => [
  `${title}: "${store.article.title}" in ${store.article.project}`,
  `  Would upload ${store.totals.parts} parts, ${store.totals.stored} B stored (${kb(store.totals.stored)}), ${store.totals.raw} B before gzip`,
  `  Largest part: ${store.totals.largest ? `${store.totals.largest.key} ${store.totals.largest.size} B` : "none"}`,
  `  Over 4,000,000 bytes after gzip: ${store.oversized.length === 0 ? "none" : store.oversized.map((p) => `${p.key} ${p.size} B`).join(", ")}`,
  `  Manifest source: ${JSON.stringify(store.manifest.source)}`,
  "  Parts:",
  ...partLines(store),
];

export const formatReport = (plan) => {
  const { source, metadata: m, npcdex: n } = plan;
  return [
    "ROMDex-Data to YouTrack migration: DRY RUN (nothing written)",
    `Run ${plan.startedAt} to ${plan.finishedAt}, target ${plan.target}`,
    "",
    `Source ${source.repo} ${source.branch} at ${source.commit} (committed ${source.committedAt}), tree ${source.tree}`,
    `  ${source.files} files, ${source.workspaceFiles} in the workspace; head unchanged at the end of the run`,
    `  Objects: ${source.objects} verified against their names, ${source.objectsUsed} used by records, ${source.unusedObjects.length} unused`,
    `  GitHub: ${source.stats.requests} requests, ${source.stats.downloads} downloads (${source.stats.downloadedBytes} B), ${source.stats.cacheHits} cache hits`,
    "",
    "Metadata verified",
    `  ${m.verified.records} records (${JSON.stringify(m.verified.kinds)}), ${m.verified.versionsVerified} versions rebuilt with before/after hashes`,
    `  Head ${m.verified.head} (sequence ${m.verified.headSequence}), canonical SHA-256 ${m.verified.canonicalSha256}`,
    `  Document ${m.verified.documentBytes} B: ${JSON.stringify(m.verified.counts)}`,
    `  Parts rejoin to ${m.verified.rejoinedSha256}`,
    "",
    "NPCDex verified",
    `  Import record ${n.verified.record} (${n.verified.createdAt}), ${n.verified.objects} objects`,
    `  npcdex-current.json ${n.verified.bytes} B, SHA-256 ${n.verified.sha256}, byte-exact JSON round trip`,
    `  Summary matches the record: ${JSON.stringify(n.verified.summary)}`,
    `  Images: ${n.verified.imageRefs} references to ${n.verified.images} distinct images, ${n.verified.inlineImages} left inline`,
    `  Recovery draft: ${JSON.stringify(n.verified.recoveryDraft)} (reported, not stored)`,
    `  Retired provider: ${JSON.stringify(n.verified.retired)}`,
    ...n.verified.warnings.map((w) => `  WARNING: ${w}`),
    `  Parts rejoin to ${n.verified.rejoinedSha256}`,
    "",
    ...storeSection("ROMDex data", m),
    "",
    ...storeSection("NPCDex data", n),
    "",
  ].join("\n");
};

// The JSON report: the plan without part bytes or parsed documents.
export const reportJson = (plan) =>
  JSON.stringify(
    plan,
    function omit(key, value) {
      return key === "encoded" ? undefined : value;
    },
    2,
  );
