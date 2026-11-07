import { imageDataUrl, parseImageDataUrl, sha256Hex, utf8 } from "./bytes.ts";
import type { PartValue } from "./files.ts";

export interface RomdexMetadata {
  version: number;
  images: Record<string, string>;
  orders: Record<string, string[]>;
  assigned: Record<string, string>;
  authorizations?: Record<string, unknown>;
  acceptances?: Record<string, unknown>;
  reviews?: Record<string, unknown>;
  testing?: Record<string, unknown>;
}

export const EXTRA_FIELDS = [
  "authorizations",
  "acceptances",
  "reviews",
  "testing",
] as const;

/** Every metadata map in document order; migration and merge derive from this. */
export const ROMDEX_FIELDS = [
  "images",
  "orders",
  "assigned",
  ...EXTRA_FIELDS,
] as const;

type ExtraField = (typeof EXTRA_FIELDS)[number];

export interface RomdexPartOptions {
  assigned: boolean;
}

const IMAGE_PREFIX = "image/";

const isFilled = (map: Record<string, unknown> | undefined): boolean => {
  return map !== undefined && Object.keys(map).length > 0;
};

const sortedMap = <T>(map: Record<string, T>): Record<string, T> => {
  return Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => {
      return a < b ? -1 : a > b ? 1 : 0;
    }),
  );
};

const versionOf = (doc: Partial<RomdexMetadata>): number => {
  for (let at = EXTRA_FIELDS.length - 1; at >= 0; at--) {
    const field = EXTRA_FIELDS[at];
    if (field !== undefined && isFilled(doc[field])) return at + 2;
  }
  return 1;
};

export const canonicalMetadata = (doc: RomdexMetadata): RomdexMetadata => {
  const version = versionOf(doc);
  const out: RomdexMetadata = {
    version,
    images: sortedMap(doc.images),
    orders: sortedMap(doc.orders),
    assigned: sortedMap(doc.assigned),
  };
  EXTRA_FIELDS.forEach((field, at) => {
    if (version >= at + 2) out[field] = sortedMap(doc[field] ?? {});
  });
  return out;
};

export const metadataHash = (doc: RomdexMetadata): Promise<string> => {
  return sha256Hex(utf8(JSON.stringify(canonicalMetadata(doc))));
};

const imageParts = (images: Record<string, string>): PartValue[] => {
  return Object.entries(images).map(([id, url]): PartValue => {
    const image = parseImageDataUrl(url);
    if (image === null)
      throw new Error(`Image "${IMAGE_PREFIX}${id}" is not a valid data URL.`);
    return {
      key: `${IMAGE_PREFIX}${id}`,
      codec: "raw",
      bytes: image.bytes,
      type: image.type,
    };
  });
};

export const metadataToParts = (
  doc: RomdexMetadata,
  options: RomdexPartOptions = { assigned: true },
): PartValue[] => {
  const parts: PartValue[] = [
    { key: "orders", codec: "gzip-json", value: doc.orders },
  ];
  if (options.assigned)
    parts.push({ key: "assigned", codec: "gzip-json", value: doc.assigned });
  parts.push(...imageParts(doc.images));
  for (const field of EXTRA_FIELDS) {
    const map = doc[field];
    if (map !== undefined && isFilled(map))
      parts.push({ key: field, codec: "gzip-json", value: map });
  }
  return parts;
};

const asMap = <T>(part: PartValue): Record<string, T> => {
  if (part.codec !== "gzip-json")
    throw new Error(`Part "${part.key}" must be JSON.`);
  return part.value as Record<string, T>;
};

const isExtra = (key: string): key is ExtraField => {
  return (EXTRA_FIELDS as readonly string[]).includes(key);
};

export const partsToMetadata = (
  parts: PartValue[],
  options: RomdexPartOptions = { assigned: true },
): RomdexMetadata => {
  const doc: RomdexMetadata = {
    version: 1,
    images: {},
    orders: {},
    assigned: {},
  };
  for (const part of parts) {
    if (part.key === "orders") doc.orders = asMap(part);
    else if (part.key === "assigned") {
      if (options.assigned) doc.assigned = asMap(part);
    } else if (isExtra(part.key)) doc[part.key] = asMap(part);
    else if (part.key.startsWith(IMAGE_PREFIX) && part.codec === "raw")
      doc.images[part.key.slice(IMAGE_PREFIX.length)] = imageDataUrl({
        type: part.type,
        bytes: part.bytes,
      });
    else throw new Error(`Unknown part "${part.key}".`);
  }
  return canonicalMetadata(doc);
};
