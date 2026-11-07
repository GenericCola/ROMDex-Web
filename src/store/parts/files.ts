import {
  fromUtf8,
  gunzipBytes,
  gzipBytes,
  sha256Hex,
  stableJson,
  utf8,
} from "./bytes.ts";
import {
  MAX_PART_BYTES,
  PartTooLargeError,
  tooLargeMessage,
} from "./limits.ts";
import type { ManifestFile, PartCodec } from "./manifest.ts";
import { attachmentName } from "./names.ts";

const MAX_UNZIPPED_BYTES = 64 * 1024 * 1024;

export type PartValue =
  | { key: string; codec: "gzip-json"; value: unknown }
  | { key: string; codec: "raw"; bytes: Uint8Array; type: string };

export interface EncodedPart {
  key: string;
  name: string;
  bytes: Uint8Array;
  sha256: string;
  size: number;
  codec: PartCodec;
  type?: string;
}

export interface RefusedPart {
  key: string;
  name: string;
  size: number;
  message: string;
}

const storedBytes = (part: PartValue): Promise<Uint8Array> => {
  return part.codec === "raw"
    ? Promise.resolve(part.bytes)
    : gzipBytes(utf8(JSON.stringify(part.value)));
};

export const encodePart = async (part: PartValue): Promise<EncodedPart> => {
  const bytes = await storedBytes(part);
  const sha256 = await sha256Hex(bytes);
  const type = part.codec === "raw" ? part.type : undefined;
  const name = attachmentName(part.key, sha256, part.codec, type);
  if (bytes.length > MAX_PART_BYTES)
    throw new PartTooLargeError(part.key, name, bytes.length);
  const encoded: EncodedPart = {
    key: part.key,
    name,
    bytes,
    sha256,
    size: bytes.length,
    codec: part.codec,
  };
  if (type !== undefined) encoded.type = type;
  return encoded;
};

export const encodeParts = async (
  parts: PartValue[],
): Promise<{ encoded: EncodedPart[]; refused: RefusedPart[] }> => {
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part.key)) throw new Error(`Duplicate part "${part.key}".`);
    seen.add(part.key);
  }
  const encoded: EncodedPart[] = [];
  const refused: RefusedPart[] = [];
  for (const part of parts) {
    try {
      encoded.push(await encodePart(part));
    } catch (error) {
      if (!(error instanceof PartTooLargeError)) throw error;
      refused.push({
        key: error.key,
        name: error.fileName,
        size: error.size,
        message: tooLargeMessage(error.fileName, error.size),
      });
    }
  }
  return { encoded, refused };
};

export const decodePart = async (
  key: string,
  file: ManifestFile,
  bytes: Uint8Array,
): Promise<PartValue> => {
  if (bytes.length !== file.size)
    throw new Error(`Part "${key}" has the wrong size.`);
  if ((await sha256Hex(bytes)) !== file.sha256)
    throw new Error(`Part "${key}" does not match its SHA-256.`);
  if (file.codec === "raw")
    return {
      key,
      codec: "raw",
      bytes,
      type: file.type ?? "application/octet-stream",
    };
  const text = fromUtf8(await gunzipBytes(bytes, MAX_UNZIPPED_BYTES));
  return { key, codec: "gzip-json", value: JSON.parse(text) };
};

export const samePartValue = (a: PartValue, b: PartValue): boolean => {
  if (a.key !== b.key) return false;
  if (a.codec === "gzip-json" && b.codec === "gzip-json")
    return stableJson(a.value) === stableJson(b.value);
  if (a.codec === "raw" && b.codec === "raw")
    return (
      a.type === b.type &&
      a.bytes.length === b.bytes.length &&
      a.bytes.every((byte, at) => {
        return byte === b.bytes[at];
      })
    );
  return false;
};
