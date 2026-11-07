import type {
  ManifestFile,
  ManifestRead,
  ManifestSource,
  StoreManifest,
  StoreName,
} from "./manifest.ts";
import { MANIFEST_FORMAT, MANIFEST_VERSION } from "./manifest.ts";

const BLOCK = /```json\n([\s\S]*?)\n```/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOP_FIELDS = [
  "format",
  "version",
  "store",
  "revision",
  "writtenAt",
  "writtenBy",
  "writeId",
  "files",
  "source",
];
const FILE_FIELDS = ["name", "sha256", "size", "where", "id", "codec", "type"];
const SOURCE_FIELDS = ["repo", "commit", "head", "sha256"];

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isCount = (value: unknown): value is number => {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
};

const isText = (value: unknown): value is string => {
  return typeof value === "string";
};

const onlyFields = (value: Json, allowed: string[]): boolean => {
  return Object.keys(value).every((key) => {
    return allowed.includes(key);
  });
};

const readFile = (key: string, value: unknown): ManifestFile | string => {
  const at = `files["${key}"]`;
  if (key.length === 0 || key.length > 300) return `${at} has a bad key.`;
  if (!isRecord(value) || !onlyFields(value, FILE_FIELDS))
    return `${at} is not a valid file entry.`;
  const { name, sha256, size, where, id, codec, type } = value;
  if (!isText(name) || name.length === 0 || name.length > 255)
    return `${at}.name is invalid.`;
  if (!isText(sha256) || !SHA256.test(sha256))
    return `${at}.sha256 is invalid.`;
  if (!isCount(size)) return `${at}.size is invalid.`;
  if (!isText(where)) return `${at}.where is invalid.`;
  if (!isText(id)) return `${at}.id is invalid.`;
  if (codec !== "gzip-json" && codec !== "raw")
    return `${at}.codec is invalid.`;
  if (type !== undefined && !isText(type)) return `${at}.type is invalid.`;
  const file: ManifestFile = { name, sha256, size, where, id, codec };
  if (type !== undefined) file.type = type;
  return file;
};

const readFiles = (value: unknown): Record<string, ManifestFile> | string => {
  if (!isRecord(value)) return "files is not an object.";
  const files: Record<string, ManifestFile> = {};
  for (const [key, entry] of Object.entries(value)) {
    const file = readFile(key, entry);
    if (typeof file === "string") return file;
    files[key] = file;
  }
  return files;
};

const readSource = (value: unknown): ManifestSource | string => {
  if (!isRecord(value) || !onlyFields(value, SOURCE_FIELDS))
    return "source is invalid.";
  const { repo, commit, head, sha256 } = value;
  if (!isText(repo) || !isText(commit) || !isText(head) || !isText(sha256))
    return "source is invalid.";
  return { repo, commit, head, sha256 };
};

const readBody = (data: Json, store: StoreName): ManifestRead => {
  const { revision, writtenAt, writtenBy, writeId } = data;
  if (!isCount(revision)) return invalid("revision is invalid.");
  if (!isText(writtenAt) || !isText(writtenBy) || !isText(writeId))
    return invalid("writtenAt, writtenBy or writeId is invalid.");
  const files = readFiles(data.files);
  if (typeof files === "string") return invalid(files);
  const manifest: StoreManifest = {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    store,
    revision,
    writtenAt,
    writtenBy,
    writeId,
    files,
  };
  if (data.source !== undefined) {
    const source = readSource(data.source);
    if (typeof source === "string") return invalid(source);
    manifest.source = source;
  }
  return { kind: "ok", manifest };
};

const invalid = (reason: string): ManifestRead => {
  return { kind: "invalid", reason };
};

export const readManifest = (
  content: string | null | undefined,
  store: StoreName,
): ManifestRead => {
  const text = BLOCK.exec(content ?? "")?.[1];
  if (text === undefined) return { kind: "missing" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return invalid("The manifest is not valid JSON.");
  }
  if (!isRecord(data) || data.format !== MANIFEST_FORMAT)
    return invalid("The manifest has the wrong format.");
  const { version } = data;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    return invalid("The manifest version is invalid.");
  if (version > MANIFEST_VERSION) return { kind: "newer", version };
  if (!onlyFields(data, TOP_FIELDS))
    return invalid("The manifest has unknown fields.");
  if (data.store !== store)
    return isText(data.store)
      ? { kind: "other-store", store: data.store }
      : invalid("store is invalid.");
  return readBody(data, store);
};
