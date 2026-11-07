// Pure verification and rebuild of ROMDex-Data. Never fetches: callers pass
// readObject(sha256) => Promise<Buffer>. Every failure throws a specific Error.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { ROMDEX_FIELDS } from "../../src/store/parts/romdex-parts.ts";

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function checkBootstrap(bytes, { sha256, workspace }) {
  const actual = sha256Hex(bytes);
  if (actual !== sha256) {
    throw new Error(
      `bootstrap.json sha256 mismatch: expected ${sha256}, got ${actual}`,
    );
  }
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (parsed.format !== "ROMDexCloudBootstrap/1") {
    throw new Error(
      `bootstrap.json format is ${parsed.format}, expected ROMDexCloudBootstrap/1`,
    );
  }
  if (parsed.workspaceId !== workspace) {
    throw new Error(
      `bootstrap.json workspaceId is ${parsed.workspaceId}, expected ${workspace}`,
    );
  }
  return parsed;
}

export async function assembleBlob(
  descriptor,
  readObject,
  { label = "blob" } = {},
) {
  const parts = [];
  const objects = [];
  for (const chunk of descriptor.chunks) {
    const data = await readObject(chunk.sha256);
    const actual = sha256Hex(data);
    if (actual !== chunk.sha256) {
      throw new Error(`${label}: chunk ${chunk.sha256} hashes to ${actual}`);
    }
    if (data.length !== chunk.bytes) {
      throw new Error(
        `${label}: chunk ${chunk.sha256} is ${data.length} bytes, expected ${chunk.bytes}`,
      );
    }
    parts.push(data);
    objects.push(chunk.sha256);
  }
  const stored = Buffer.concat(parts);
  if (stored.length !== descriptor.bytes) {
    throw new Error(
      `${label}: stored length ${stored.length}, expected ${descriptor.bytes}`,
    );
  }
  const storedHash = sha256Hex(stored);
  if (storedHash !== descriptor.sha256) {
    throw new Error(
      `${label}: stored sha256 ${storedHash}, expected ${descriptor.sha256}`,
    );
  }
  let bytes;
  if (descriptor.codec === "raw-utf8") {
    bytes = stored;
  } else if (descriptor.codec === "gzip") {
    if (stored[0] !== 0x1f || stored[1] !== 0x8b) {
      throw new Error(
        `${label}: stored bytes do not start with the gzip magic 1f 8b`,
      );
    }
    bytes = gunzipSync(stored);
    if (bytes.length !== descriptor.expandedBytes) {
      throw new Error(
        `${label}: expanded length ${bytes.length}, expected ${descriptor.expandedBytes}`,
      );
    }
    const expandedHash = sha256Hex(bytes);
    if (expandedHash !== descriptor.expandedSha256) {
      throw new Error(
        `${label}: expanded sha256 ${expandedHash}, expected ${descriptor.expandedSha256}`,
      );
    }
  } else {
    throw new Error(`${label}: unknown codec ${descriptor.codec}`);
  }
  return { bytes, stored: stored.length, objects };
}

function fieldsFor(doc) {
  return ROMDEX_FIELDS.slice(0, doc.version + 2);
}

export function emptyMetadata() {
  return { version: 1, images: {}, orders: {}, assigned: {} };
}

function sortedMap(map) {
  const out = {};
  for (const key of Object.keys(map ?? {}).sort()) out[key] = map[key];
  return out;
}

export function canonicalMetadata(doc) {
  const out = { version: doc.version };
  for (const field of fieldsFor(doc)) out[field] = sortedMap(doc[field]);
  return out;
}

export function metadataHash(doc) {
  return sha256Hex(JSON.stringify(canonicalMetadata(doc)));
}

export function applyChanges(doc, changes) {
  const fields = fieldsFor(doc);
  const next = canonicalMetadata(doc);
  for (const { field, key, before, after } of changes) {
    if (!fields.includes(field)) {
      throw new Error(
        `unsupported field "${field}" for metadata version ${doc.version}`,
      );
    }
    const map = next[field];
    const current = Object.hasOwn(map, key) ? map[key] : null;
    if (JSON.stringify(current) !== JSON.stringify(before)) {
      throw new Error(
        `change ${field}/${key}: current value does not match "before"`,
      );
    }
    if (after === null) delete map[key];
    else map[key] = after;
  }
  return next;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// `hash` only exists so tests can exercise the cycle detector: real ids are
// content hashes, so a genuine cycle cannot be built with them.
export async function loadMetadata({
  workspace,
  genesis,
  records,
  readObject,
  hash = sha256Hex,
}) {
  if (genesis.format !== "ROMDexMetadataRoot/1") {
    throw new Error(`metadata genesis.json format is ${genesis.format}`);
  }
  if (genesis.workspace !== workspace) {
    throw new Error(
      `metadata genesis.json workspace is ${genesis.workspace}, expected ${workspace}`,
    );
  }

  const parsed = new Map();
  for (const [id, bytes] of records) {
    const actual = hash(bytes);
    if (actual !== id)
      throw new Error(`metadata record ${id} hashes to ${actual}`);
    const record = JSON.parse(bytes.toString("utf8"));
    if (record.workspace !== workspace) {
      throw new Error(
        `metadata record ${id} workspace is ${record.workspace}, expected ${workspace}`,
      );
    }
    parsed.set(id, record);
  }

  const genesisIds = [...parsed]
    .filter(([, r]) => r.format === "ROMDexMetadataGenesis/1")
    .map(([id]) => id);
  if (genesisIds.length !== 1) {
    throw new Error(
      `expected exactly one metadata genesis record, found ${genesisIds.length}`,
    );
  }
  const genesisId = genesisIds[0];
  if (genesisId !== genesis.record) {
    throw new Error(
      `metadata genesis record is ${genesisId}, genesis.json names ${genesis.record}`,
    );
  }
  const genesisRecord = parsed.get(genesisId);
  if (genesisRecord.parents.length !== 0) {
    throw new Error(`metadata genesis record ${genesisId} has parents`);
  }
  if (genesisRecord.after !== metadataHash(emptyMetadata())) {
    throw new Error(
      `metadata genesis record ${genesisId} after is not the empty document hash`,
    );
  }

  const edits = { edit: 0, merge: 0, resolution: 0 };
  for (const [id, record] of parsed) {
    if (id === genesisId) continue;
    if (record.format !== "ROMDexMetadataChange/1") {
      throw new Error(`metadata record ${id} has format ${record.format}`);
    }
    if (record.namespace !== "romdex-metadata") {
      throw new Error(
        `metadata record ${id} has namespace ${record.namespace}`,
      );
    }
    if (!Object.hasOwn(edits, record.kind)) {
      throw new Error(`metadata record ${id} has kind ${record.kind}`);
    }
    for (const parent of record.parents) {
      if (!parsed.has(parent))
        throw new Error(`metadata record ${id} names missing parent ${parent}`);
    }
    if (!parsed.has(record.base))
      throw new Error(
        `metadata record ${id} names missing base ${record.base}`,
      );
    if (!record.parents.includes(record.base)) {
      throw new Error(
        `metadata record ${id} base ${record.base} is not one of its parents`,
      );
    }
    edits[record.kind] += 1;
  }

  // Topological order over parents (base is always a parent). Anything left
  // unprocessed sits on a cycle or cannot reach the genesis.
  const children = new Map([...parsed.keys()].map((id) => [id, []]));
  const waiting = new Map();
  for (const [id, record] of parsed) {
    waiting.set(id, record.parents.length);
    for (const parent of record.parents) children.get(parent).push(id);
  }
  const order = [];
  const queue = [genesisId];
  while (queue.length > 0) {
    const id = queue.pop();
    order.push(id);
    for (const child of children.get(id)) {
      waiting.set(child, waiting.get(child) - 1);
      if (waiting.get(child) === 0) queue.push(child);
    }
  }
  if (order.length !== parsed.size) {
    const stuck = [...parsed.keys()].filter((id) => !order.includes(id));
    throw new Error(
      `metadata chain has a cycle or does not reach the genesis: ${stuck.join(", ")}`,
    );
  }

  const referenced = new Set();
  for (const record of parsed.values())
    for (const parent of record.parents) referenced.add(parent);
  const heads = [...parsed.keys()].filter((id) => !referenced.has(id));
  if (heads.length > 1) {
    throw fail(
      "MULTIPLE_HEADS",
      `ROMDex metadata has ${heads.length} heads (${heads.join(", ")}). Open the desktop app so it merges them, then run again.`,
    );
  }
  const head = heads.length === 0 ? genesisId : heads[0];

  const docs = new Map([[genesisId, emptyMetadata()]]);
  const objectShas = new Set();
  let payloadBytes = 0;
  let versionsVerified = 0;
  for (const id of order) {
    if (id === genesisId) continue;
    const record = parsed.get(id);
    const baseDoc = docs.get(record.base);
    const baseHash = metadataHash(baseDoc);
    if (record.before !== baseHash) {
      throw new Error(
        `metadata record ${id} before is ${record.before}, base document hashes to ${baseHash}`,
      );
    }
    const blob = await assembleBlob(record.payload, readObject, {
      label: `metadata record ${id} payload`,
    });
    for (const sha of blob.objects) objectShas.add(sha);
    payloadBytes += blob.stored;
    const changes = JSON.parse(blob.bytes.toString("utf8"));
    let result;
    try {
      result = applyChanges(baseDoc, changes);
    } catch (error) {
      throw new Error(`metadata record ${id}: ${error.message}`);
    }
    const resultHash = metadataHash(result);
    if (record.after !== resultHash) {
      throw new Error(
        `metadata record ${id} after is ${record.after}, rebuilt document hashes to ${resultHash}`,
      );
    }
    docs.set(id, result);
    versionsVerified += 1;
  }

  const document = canonicalMetadata(docs.get(head));
  return {
    genesisId,
    head,
    headRecord: parsed.get(head),
    records: parsed.size,
    edits,
    versionsVerified,
    objects: objectShas.size,
    payloadBytes,
    document,
    sha256: metadataHash(document),
  };
}

function sumLengths(items, pick) {
  let total = 0;
  for (const item of items) total += (pick(item) ?? []).length;
  return total;
}

function collectImages(value, found) {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectImages(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectImages(item, found);
  }
}

export function npcdexSummary(doc) {
  const towns = doc.towns ?? [];
  const areas = towns.flatMap((town) => town.areas ?? []);
  const elements = areas.flatMap((area) => area.elements ?? []);
  const points = elements.flatMap((element) => element.points ?? []);
  const images = [];
  collectImages(doc, images);
  return {
    revision: doc.revision,
    towns: towns.length,
    areas: areas.length,
    elements: elements.length,
    points: points.length,
    blocks: sumLengths(points, (point) => point.blocks),
    characters: sumLengths(towns, (town) => town.characters),
    plans: Object.keys(doc.changePlans ?? {}).length,
    history: (doc.history ?? []).length,
    receipts: (doc.implementationReceipts ?? []).length,
    requests: (doc.changeRequests ?? []).length,
    annotations: Object.keys(doc.annotations ?? {}).length,
    embeddedImages: images.length,
    imageBytes: images.reduce(
      (sum, uri) =>
        sum + Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64").length,
      0,
    ),
  };
}

export async function loadNpcdex({
  workspace,
  genesis,
  records,
  retired,
  readObject,
  expect,
}) {
  if (genesis.format !== "ROMDexNPCDexGenesis/1") {
    throw new Error(`npcdex genesis.json format is ${genesis.format}`);
  }
  if (genesis.workspace !== workspace) {
    throw new Error(
      `npcdex genesis.json workspace is ${genesis.workspace}, expected ${workspace}`,
    );
  }
  for (const [id, bytes] of records) {
    const actual = sha256Hex(bytes);
    if (actual !== id)
      throw new Error(`npcdex record ${id} hashes to ${actual}`);
  }
  if (records.size !== 1) {
    throw new Error(
      `npcdex has ${records.size} records; change records are not supported, expected only the import`,
    );
  }
  const [recordId, recordBytes] = [...records][0];
  if (recordId !== genesis.record) {
    throw new Error(
      `npcdex record is ${recordId}, genesis.json names ${genesis.record}`,
    );
  }
  const record = JSON.parse(recordBytes.toString("utf8"));
  if (record.format !== "ROMDexNPCDexImport/1")
    throw new Error(`npcdex record ${recordId} has format ${record.format}`);
  if (record.workspace !== workspace) {
    throw new Error(
      `npcdex record ${recordId} workspace is ${record.workspace}, expected ${workspace}`,
    );
  }
  if ((record.parents ?? []).length !== 0)
    throw new Error(`npcdex record ${recordId} has parents`);

  const documents = new Map();
  for (const doc of record.documents) {
    if (
      doc.name !== "npcdex-current.json" &&
      doc.name !== "npcdex-recovery-draft.json"
    ) {
      throw new Error(
        `npcdex record ${recordId} has unexpected document ${doc.name}`,
      );
    }
    documents.set(doc.name, doc);
  }
  for (const name of ["npcdex-current.json", "npcdex-recovery-draft.json"]) {
    if (!documents.has(name))
      throw new Error(`npcdex record ${recordId} lacks document ${name}`);
  }

  const objectShas = new Set();
  const current = await assembleBlob(
    documents.get("npcdex-current.json"),
    readObject,
    {
      label: "npcdex-current.json",
    },
  );
  const draft = await assembleBlob(
    documents.get("npcdex-recovery-draft.json"),
    readObject,
    {
      label: "npcdex-recovery-draft.json",
    },
  );
  for (const sha of [...current.objects, ...draft.objects]) objectShas.add(sha);

  const currentHash = sha256Hex(current.bytes);
  if (currentHash !== expect.sha256) {
    throw new Error(
      `npcdex-current.json sha256 is ${currentHash}, expected ${expect.sha256}`,
    );
  }
  if (current.bytes.length !== expect.bytes) {
    throw new Error(
      `npcdex-current.json is ${current.bytes.length} bytes, expected ${expect.bytes}`,
    );
  }
  const document = JSON.parse(current.bytes.toString("utf8"));
  if (!Buffer.from(JSON.stringify(document)).equals(current.bytes)) {
    throw new Error(
      "npcdex-current.json is not byte-exact under JSON.parse/JSON.stringify",
    );
  }
  const summary = npcdexSummary(document);
  const differing = Object.keys(summary).filter(
    (key) => !isDeepStrictEqual(summary[key], record.summary?.[key]),
  );
  if (differing.length > 0) {
    const detail = differing.map(
      (key) => `${key}: record ${record.summary?.[key]}, file ${summary[key]}`,
    );
    throw new Error(`npcdex summary mismatch (${detail.join("; ")})`);
  }

  const recoveryDraft = draft.bytes.toString("utf8");
  const warnings = [];
  if (recoveryDraft !== "null")
    warnings.push(
      `npcdex recovery draft is not null (${draft.bytes.length} bytes)`,
    );

  let retiredInfo = null;
  if (retired) {
    if (retired.format !== "ROMDexRetiredNPCDexProvider/1") {
      throw new Error(
        `npcdex retired-provider.json format is ${retired.format}`,
      );
    }
    if (retired.workspace !== workspace) {
      throw new Error(
        `npcdex retired-provider.json workspace is ${retired.workspace}, expected ${workspace}`,
      );
    }
    if (retired.acceptedSourceSHA256 !== expect.sha256) {
      throw new Error(
        `retired-provider acceptedSourceSHA256 is ${retired.acceptedSourceSHA256}, expected ${expect.sha256}`,
      );
    }
    if (retired.acceptedSourceHead !== genesis.record) {
      throw new Error(
        `retired-provider acceptedSourceHead is ${retired.acceptedSourceHead}, expected ${genesis.record}`,
      );
    }
    retiredInfo = {
      retiredAt: retired.retiredAt,
      registryIssueId: retired.authority?.registryIssueId ?? null,
    };
  }

  return {
    recordId,
    createdAt: record.createdAt,
    document,
    bytes: current.bytes,
    sha256: currentHash,
    summary,
    recoveryDraft,
    warnings,
    objects: objectShas.size,
    retired: retiredInfo,
  };
}
