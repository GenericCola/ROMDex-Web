// The migration's view of the store parts encoder in src/store/parts (the same
// code the browser uses), so the migration writes exactly what the app reads.
// Node 24 loads the .ts modules directly.
import {
  decodePart as decodeStorePart,
  encodeParts as encodeStoreParts,
  MAX_PART_BYTES,
  metadataToParts,
  NPCDEX_IMAGE_REF,
  npcdexToParts,
  partsToMetadata,
  partsToNpcdex,
} from "../../src/store/parts/index.ts";

export { MAX_PART_BYTES };

export const splitMetadata = (doc) => metadataToParts(doc);

export const joinMetadata = (parts) => partsToMetadata(parts);

// Counts image references and data URLs the encoder left inline (not valid
// base64 image data URLs), so the report can show nothing was missed.
const countImages = (value, counts) => {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) counts.inlineImages += 1;
  } else if (Array.isArray(value)) {
    for (const item of value) countImages(item, counts);
  } else if (value && typeof value === "object") {
    if (typeof value[NPCDEX_IMAGE_REF] === "string") counts.imageRefs += 1;
    else for (const item of Object.values(value)) countImages(item, counts);
  }
  return counts;
};

export const splitNpcdex = async (doc) => {
  const parts = await npcdexToParts(doc);
  const counts = { imageRefs: 0, inlineImages: 0 };
  for (const part of parts) {
    if (part.codec === "gzip-json") countImages(part.value, counts);
  }
  const images = parts.filter((part) => part.codec === "raw").length;
  return { parts, images, ...counts };
};

export const joinNpcdex = (parts) => partsToNpcdex(parts).document;

const rawSize = (part) =>
  part.codec === "raw"
    ? part.bytes.length
    : Buffer.byteLength(JSON.stringify(part.value));

/**
 * Encodes parts with the store encoder. Parts over MAX_PART_BYTES after gzip
 * come back in `refused` with the store's message instead of throwing.
 */
export const encodeParts = async (parts) => {
  const sizes = new Map(parts.map((part) => [part.key, rawSize(part)]));
  const { encoded, refused } = await encodeStoreParts(parts);
  return {
    encoded: encoded.map((part) => ({ ...part, rawSize: sizes.get(part.key) })),
    refused: refused.map((part) => ({ ...part, rawSize: sizes.get(part.key) })),
  };
};

export const decodePart = (encoded) =>
  decodeStorePart(encoded.key, encoded, encoded.bytes);
