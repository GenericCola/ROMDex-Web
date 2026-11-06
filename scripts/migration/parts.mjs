import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

export const IMAGE_DATA_URL =
  /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/;
export const MAX_PART_BYTES = 4_000_000;

const KEY_PATTERN = /^[A-Za-z0-9._/-]+$/;
const TOWN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const OPTIONAL_MAPS = [
  ["authorizations", 2],
  ["acceptances", 3],
  ["reviews", 4],
  ["testing", 5],
];
const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export function parseImageDataUrl(s) {
  if (typeof s !== "string") return null;
  const match = IMAGE_DATA_URL.exec(s);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2]) return null;
  return { type: match[1], bytes };
}

export function imageDataUrl(type, bytes) {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function jsonPart(key, value) {
  return { key, codec: "gzip-json", value };
}

function imagePart(key, image) {
  return { key, codec: "raw", type: image.type, bytes: image.bytes };
}

// ---- ROMDex metadata ----

export function splitMetadata(doc) {
  const allowed = new Set([
    "version",
    "images",
    "orders",
    "assigned",
    ...OPTIONAL_MAPS.map(([name]) => name),
  ]);
  for (const field of Object.keys(doc)) {
    if (!allowed.has(field)) {
      throw new Error(`Unknown metadata field: ${field}`);
    }
  }
  const parts = [
    jsonPart("orders", doc.orders ?? {}),
    jsonPart("assigned", doc.assigned ?? {}),
  ];
  for (const [name] of OPTIONAL_MAPS) {
    const map = doc[name];
    if (map && Object.keys(map).length > 0) parts.push(jsonPart(name, map));
  }
  const images = doc.images ?? {};
  for (const key of Object.keys(images).sort()) {
    const image = parseImageDataUrl(images[key]);
    if (!image) throw new Error(`Image ${key} is not a base64 image data URL`);
    parts.push(imagePart(`image/${key}`, image));
  }
  return parts;
}

export function joinMetadata(parts) {
  const byKey = new Map(parts.map((p) => [p.key, p]));
  let version = 1;
  for (const [name, level] of OPTIONAL_MAPS) {
    if (byKey.has(name)) version = Math.max(version, level);
  }
  const images = {};
  const imageParts = parts
    .filter((p) => p.key.startsWith("image/"))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const p of imageParts) {
    images[p.key.slice("image/".length)] = imageDataUrl(p.type, p.bytes);
  }
  const doc = {
    version,
    images,
    orders: byKey.get("orders")?.value ?? {},
    assigned: byKey.get("assigned")?.value ?? {},
  };
  for (const [name, level] of OPTIONAL_MAPS) {
    if (level <= version) doc[name] = byKey.get(name)?.value ?? {};
  }
  return doc;
}

// ---- NPCDex ----

function assertNoMarkerKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoMarkerKeys(item);
  } else if (isObject(value)) {
    for (const key of Object.keys(value)) {
      if (key === "$image" || key === "$part") {
        throw new Error(`Document already has a reserved key: ${key}`);
      }
      assertNoMarkerKeys(value[key]);
    }
  }
}

function replaceImages(value, state) {
  if (typeof value === "string") {
    const image = parseImageDataUrl(value);
    if (image) {
      const hash = sha256Hex(image.bytes);
      state.images.set(hash, image);
      state.imageRefs += 1;
      return { $image: hash, type: image.type };
    }
    if (value.startsWith("data:image/")) state.inlineImages += 1;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => replaceImages(v, state));
  if (isObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = replaceImages(value[key], state);
    }
    return out;
  }
  return value;
}

export function splitNpcdex(doc) {
  assertNoMarkerKeys(doc);
  const state = { images: new Map(), imageRefs: 0, inlineImages: 0 };
  const clean = replaceImages(doc, state);

  const townParts = [];
  const ids = new Set();
  if (clean.towns !== undefined) {
    if (!Array.isArray(clean.towns)) throw new Error("towns must be an array");
    for (const town of clean.towns) {
      const id = town?.id;
      if (typeof id !== "string" || !TOWN_ID_PATTERN.test(id)) {
        throw new Error(`Bad town id: ${JSON.stringify(id)}`);
      }
      if (ids.has(id)) throw new Error(`Duplicate town id: ${id}`);
      ids.add(id);
      townParts.push(jsonPart(`town/${id}`, town));
    }
  }

  const extracted = [
    ["annotations", "annotations"],
    ["changePlans", "plans"],
    ["history", "history"],
  ];
  const root = {};
  for (const field of Object.keys(clean)) {
    if (field === "towns") {
      root[field] = { $part: "town", ids: [...ids] };
    } else {
      const hit = extracted.find(([name]) => name === field);
      root[field] = hit ? { $part: hit[1] } : clean[field];
    }
  }

  const parts = [jsonPart("root", root), ...townParts];
  for (const [field, key] of extracted) {
    if (clean[field] !== undefined) parts.push(jsonPart(key, clean[field]));
  }
  for (const hash of [...state.images.keys()].sort()) {
    parts.push(imagePart(`image/${hash}`, state.images.get(hash)));
  }
  return {
    parts,
    images: state.images.size,
    imageRefs: state.imageRefs,
    inlineImages: state.inlineImages,
  };
}

function needPart(byKey, key) {
  const part = byKey.get(key);
  if (!part) throw new Error(`Missing part: ${key}`);
  return part;
}

function restoreMarkers(value, byKey) {
  if (Array.isArray(value)) return value.map((v) => restoreMarkers(v, byKey));
  if (!isObject(value)) return value;
  const keys = Object.keys(value);
  if (keys.includes("$part")) {
    const kind = value.$part;
    if (kind === "town") {
      return value.ids.map((id) => needPart(byKey, `town/${id}`).value);
    }
    return needPart(byKey, kind).value;
  }
  const out = {};
  for (const key of keys) out[key] = restoreMarkers(value[key], byKey);
  return out;
}

function restoreImages(value, byKey) {
  if (Array.isArray(value)) return value.map((v) => restoreImages(v, byKey));
  if (!isObject(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 2 && keys.includes("$image") && keys.includes("type")) {
    const part = needPart(byKey, `image/${value.$image}`);
    return imageDataUrl(value.type, part.bytes);
  }
  const out = {};
  for (const key of keys) out[key] = restoreImages(value[key], byKey);
  return out;
}

export function joinNpcdex(parts) {
  const byKey = new Map(parts.map((p) => [p.key, p]));
  const root = needPart(byKey, "root").value;
  return restoreImages(restoreMarkers(root, byKey), byKey);
}

// ---- encoding ----

export function encodePart(part) {
  if (!KEY_PATTERN.test(part.key)) {
    throw new Error(`Bad part key: ${JSON.stringify(part.key)}`);
  }
  let bytes;
  let rawSize;
  let ext;
  if (part.codec === "gzip-json") {
    const raw = Buffer.from(JSON.stringify(part.value));
    bytes = gzipSync(raw, { level: 9 });
    rawSize = raw.length;
    ext = "json.gz";
  } else if (part.codec === "raw") {
    bytes = part.bytes;
    rawSize = bytes.length;
    ext = EXTENSIONS[part.type] ?? "bin";
  } else {
    throw new Error(`Unknown codec: ${part.codec}`);
  }
  const sha256 = sha256Hex(bytes);
  const name = `${part.key.replaceAll("/", "--")}--${sha256.slice(0, 16)}.${ext}`;
  const encoded = {
    key: part.key,
    name,
    codec: part.codec,
    sha256,
    size: bytes.length,
    rawSize,
    bytes,
  };
  if (part.codec === "raw") encoded.type = part.type;
  return encoded;
}

export function decodePart(encoded) {
  const { bytes } = encoded;
  if (bytes.length !== encoded.size || sha256Hex(bytes) !== encoded.sha256) {
    throw new Error(`Part ${encoded.key} does not match its sha256/size`);
  }
  if (encoded.codec === "gzip-json") {
    const value = JSON.parse(gunzipSync(bytes).toString("utf8"));
    return { key: encoded.key, codec: "gzip-json", value };
  }
  return { key: encoded.key, codec: "raw", type: encoded.type, bytes };
}

export function oversized(encodedParts) {
  return encodedParts.filter((p) => p.size > MAX_PART_BYTES);
}
