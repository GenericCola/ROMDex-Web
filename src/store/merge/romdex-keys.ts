import type { FlatValues } from "@/store/merge/merge";

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

export const ROMDEX_FIELDS = [
  "images",
  "orders",
  "assigned",
  "authorizations",
  "acceptances",
  "reviews",
  "testing",
] as const;
type RomdexField = (typeof ROMDEX_FIELDS)[number];

/** Merge-key prefix for each field ("images" is keyed as "image/<id>"). */
const PREFIX: Record<RomdexField, string> = {
  images: "image",
  orders: "orders",
  assigned: "assigned",
  authorizations: "authorizations",
  acceptances: "acceptances",
  reviews: "reviews",
  testing: "testing",
};

const fieldOf = (prefix: string): RomdexField => {
  const found = ROMDEX_FIELDS.find((field) => {
    return PREFIX[field] === prefix;
  });
  if (!found) throw new Error(`Unknown ROMDex merge key prefix: ${prefix}`);
  return found;
};

export const flattenMetadata = (doc: RomdexMetadata): FlatValues => {
  const flat: FlatValues = {};
  for (const field of ROMDEX_FIELDS) {
    const entries = doc[field] ?? {};
    for (const [key, value] of Object.entries(entries))
      flat[`${PREFIX[field]}/${key}`] = value;
  }
  return flat;
};

const sortedRecord = (source: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => {
        return [key, source[key]];
      }),
  );
};

export const unflattenMetadata = (flat: FlatValues): RomdexMetadata => {
  const groups: Record<RomdexField, Record<string, unknown>> = {
    images: {},
    orders: {},
    assigned: {},
    authorizations: {},
    acceptances: {},
    reviews: {},
    testing: {},
  };
  for (const [flatKey, value] of Object.entries(flat)) {
    const slash = flatKey.indexOf("/");
    if (slash < 0) throw new Error(`Invalid ROMDex merge key: ${flatKey}`);
    groups[fieldOf(flatKey.slice(0, slash))][flatKey.slice(slash + 1)] = value;
  }
  const has = (field: RomdexField) => {
    return Object.keys(groups[field]).length > 0;
  };
  const version = has("testing")
    ? 5
    : has("reviews")
      ? 4
      : has("acceptances")
        ? 3
        : has("authorizations")
          ? 2
          : 1;
  const doc: RomdexMetadata = {
    version,
    images: sortedRecord(groups.images) as Record<string, string>,
    orders: sortedRecord(groups.orders) as Record<string, string[]>,
    assigned: sortedRecord(groups.assigned) as Record<string, string>,
  };
  if (version >= 2) doc.authorizations = sortedRecord(groups.authorizations);
  if (version >= 3) doc.acceptances = sortedRecord(groups.acceptances);
  if (version >= 4) doc.reviews = sortedRecord(groups.reviews);
  if (version >= 5) doc.testing = sortedRecord(groups.testing);
  return doc;
};
