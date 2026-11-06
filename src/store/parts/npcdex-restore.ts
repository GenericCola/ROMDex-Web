import { imageDataUrl } from "./bytes.ts";
import type { PartValue } from "./files.ts";
import type { NpcdexDraftsPart, RawImage } from "./npcdex-parts.ts";
import {
  IMAGE_PREFIX,
  isRecord,
  NPCDEX_IMAGE_REF,
  OWN_PARTS,
  TOWN_PREFIX,
} from "./npcdex-parts.ts";

type Json = Record<string, unknown>;

const restoreImages = (
  value: unknown,
  images: Map<string, RawImage>,
): unknown => {
  if (Array.isArray(value))
    return value.map((item) => {
      return restoreImages(item, images);
    });
  if (!isRecord(value)) return value;
  const hash = value[NPCDEX_IMAGE_REF];
  if (typeof hash === "string") {
    const image = images.get(hash);
    if (image === undefined)
      throw new Error(`Missing part "${IMAGE_PREFIX}${hash}".`);
    return imageDataUrl(image);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      return [key, restoreImages(item, images)] as const;
    }),
  );
};

const indexParts = (parts: PartValue[]): Map<string, PartValue> => {
  const byKey = new Map<string, PartValue>();
  for (const part of parts) {
    if (byKey.has(part.key)) throw new Error(`Duplicate part "${part.key}".`);
    byKey.set(part.key, part);
  }
  return byKey;
};

const jsonPart = (byKey: Map<string, PartValue>, key: string): unknown => {
  const part = byKey.get(key);
  if (part === undefined) throw new Error(`Missing part "${key}".`);
  if (part.codec !== "gzip-json")
    throw new Error(`Part "${key}" must be JSON.`);
  return part.value;
};

const imagesOf = (byKey: Map<string, PartValue>): Map<string, RawImage> => {
  const images = new Map<string, RawImage>();
  for (const part of byKey.values())
    if (part.codec === "raw" && part.key.startsWith(IMAGE_PREFIX))
      images.set(part.key.slice(IMAGE_PREFIX.length), part);
  return images;
};

const checkKnown = (byKey: Map<string, PartValue>, townIds: string[]): void => {
  const known = new Set<string>([
    "root",
    "drafts",
    ...Object.values(OWN_PARTS),
    ...townIds.map((id) => {
      return `${TOWN_PREFIX}${id}`;
    }),
  ]);
  for (const part of byKey.values()) {
    const image = part.codec === "raw" && part.key.startsWith(IMAGE_PREFIX);
    if (!image && !known.has(part.key))
      throw new Error(`Unknown part "${part.key}".`);
  }
};

const readRoot = (
  value: unknown,
): { keys: string[]; towns: string[]; fields: Json } => {
  if (!isRecord(value) || !isRecord(value.fields))
    throw new Error('Part "root" is invalid.');
  const { keys, towns, fields } = value;
  const texts = (list: unknown): list is string[] => {
    return (
      Array.isArray(list) &&
      list.every((item) => {
        return typeof item === "string";
      })
    );
  };
  if (!texts(keys) || !texts(towns)) throw new Error('Part "root" is invalid.');
  return { keys, towns, fields };
};

export const partsToNpcdex = (
  parts: PartValue[],
): { document: Json; drafts: NpcdexDraftsPart | null } => {
  const byKey = indexParts(parts);
  const root = readRoot(jsonPart(byKey, "root"));
  checkKnown(byKey, root.towns);
  const images = imagesOf(byKey);
  const restore = (key: string): unknown => {
    return restoreImages(jsonPart(byKey, key), images);
  };
  const document: Json = {};
  for (const key of root.keys) {
    const own = OWN_PARTS[key];
    if (key === "towns")
      document[key] = root.towns.map((id) => {
        return restore(`${TOWN_PREFIX}${id}`);
      });
    else if (own !== undefined) document[key] = restore(own);
    else if (key in root.fields)
      document[key] = restoreImages(root.fields[key], images);
    else throw new Error(`Part "root" lacks field "${key}".`);
  }
  const hasDrafts = byKey.has("drafts");
  return {
    document: Object.fromEntries(Object.entries(document)),
    drafts: hasDrafts ? (jsonPart(byKey, "drafts") as NpcdexDraftsPart) : null,
  };
};
