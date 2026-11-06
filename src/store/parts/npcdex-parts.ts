import { parseImageDataUrl, sha256Hex } from "./bytes.ts";
import type { PartValue } from "./files.ts";

export interface NpcdexDraftsPart {
  drafts: Record<string, unknown>;
  history: unknown[];
}

export const NPCDEX_IMAGE_REF = "$image";

type Json = Record<string, unknown>;
export interface RawImage {
  type: string;
  bytes: Uint8Array;
}

export const IMAGE_PREFIX = "image/";
export const TOWN_PREFIX = "town/";
export const OWN_PARTS: Record<string, string> = {
  annotations: "annotations",
  changePlans: "plans",
  history: "history",
};

export const isRecord = (value: unknown): value is Json => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const mapEntries = async (
  source: Json,
  convert: (value: unknown) => Promise<unknown>,
): Promise<Json> => {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(source).map(async ([key, value]) => {
        return [key, await convert(value)] as const;
      }),
    ),
  );
};

const extractImages = async (
  value: unknown,
  images: Map<string, RawImage>,
): Promise<unknown> => {
  if (typeof value === "string") {
    const image = parseImageDataUrl(value);
    if (image === null) return value;
    const hash = await sha256Hex(image.bytes);
    images.set(hash, image);
    return { [NPCDEX_IMAGE_REF]: hash, type: image.type };
  }
  if (Array.isArray(value))
    return Promise.all(
      value.map((item) => {
        return extractImages(item, images);
      }),
    );
  if (!isRecord(value)) return value;
  if (NPCDEX_IMAGE_REF in value)
    throw new Error("NPCDex data uses the reserved $image key.");
  return mapEntries(value, (item) => {
    return extractImages(item, images);
  });
};

const townsOf = (doc: Json): Json[] => {
  const { towns } = doc;
  if (!Array.isArray(towns)) throw new Error("NPCDex towns must be a list.");
  const seen = new Set<string>();
  return towns.map((town: unknown): Json => {
    const id = isRecord(town) ? town.id : undefined;
    if (!isRecord(town) || typeof id !== "string" || id === "")
      throw new Error("Every NPCDex town needs a text id.");
    if (seen.has(id)) throw new Error(`Duplicate NPCDex town id "${id}".`);
    seen.add(id);
    return town;
  });
};

const json = (key: string, value: unknown): PartValue => {
  return {
    key,
    codec: "gzip-json",
    value,
  };
};

export const npcdexToParts = async (
  doc: Json,
  drafts?: NpcdexDraftsPart,
): Promise<PartValue[]> => {
  if (NPCDEX_IMAGE_REF in doc)
    throw new Error("NPCDex data uses the reserved $image key.");
  const images = new Map<string, RawImage>();
  const towns = townsOf(doc);
  const townParts: PartValue[] = [];
  for (const town of towns)
    townParts.push(
      json(
        `${TOWN_PREFIX}${String(town.id)}`,
        await extractImages(town, images),
      ),
    );
  const ownParts: PartValue[] = [];
  const fields: Json = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "towns") continue;
    const converted = await extractImages(value, images);
    const part = OWN_PARTS[key];
    if (part === undefined) fields[key] = converted;
    else ownParts.push(json(part, converted));
  }
  const root = {
    keys: Object.keys(doc),
    towns: towns.map((town) => {
      return String(town.id);
    }),
    fields,
  };
  const parts = [json("root", root), ...townParts, ...ownParts];
  if (drafts !== undefined) parts.push(json("drafts", drafts));
  for (const [hash, image] of images)
    parts.push({
      key: `${IMAGE_PREFIX}${hash}`,
      codec: "raw",
      bytes: image.bytes,
      type: image.type,
    });
  return parts;
};
