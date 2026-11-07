import type { WorkspaceData } from "@/domain/types";
import { imageRefOf, imageUrl, putImage } from "@/storage/image-storage";
import { flattenMetadata, unflattenMetadata } from "@/store/merge";
import type { PartValue } from "../parts/files.ts";
import { metadataToParts, partsToMetadata } from "../parts/romdex-parts.ts";
import { applyAssigned, localAssigned } from "./assigned.ts";
import type { StoreBinding } from "./binding.ts";
import { applyOrders, localOrders } from "./romdex-orders.ts";

const IMAGE_ID = /^PMON-[1-9]\d*$/;
const IMAGE = "image/";
const EXTRAS = ["authorizations/", "acceptances/", "reviews/", "testing/"];

const carriedExtras = (
  base: Record<string, unknown> | null,
  remote: Record<string, unknown>,
) => {
  return Object.fromEntries(
    Object.entries(base ?? remote).filter(([key]) => {
      return EXTRAS.some((prefix) => {
        return key.startsWith(prefix);
      });
    }),
  );
};

const localImages = (data: WorkspaceData) => {
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(data.images ?? {})) {
    if (!IMAGE_ID.test(id)) continue;
    const url = imageUrl(value);
    if (url === null) throw Error("A tile image is not loaded; sync waits.");
    out[`${IMAGE}${id}`] = url;
  }
  return out;
};

const applyImages = (
  data: WorkspaceData,
  values: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    if (!key.startsWith(IMAGE)) continue;
    const id = key.slice(IMAGE.length);
    if (!IMAGE_ID.test(id)) continue;
    const value = values[key];
    if (typeof value === "string") {
      data.images = { ...data.images, [id]: imageRefOf(value) };
    } else if (data.images && Object.hasOwn(data.images, id)) {
      const images = { ...data.images };
      delete images[id];
      data.images = images;
    }
  }
};

export const romdexBinding: StoreBinding = {
  store: "romdex-metadata",
  ready: (data) => {
    return data.remote.length > 0 ? null : "Read YouTrack tasks first.";
  },
  remote: (parts) => {
    return flattenMetadata(partsToMetadata(parts, { assigned: true }));
  },
  local: (data, base, remote) => {
    return {
      ...localImages(data),
      ...localOrders(data, base, remote),
      ...carriedExtras(base, remote),
      ...localAssigned(data, base, remote),
    };
  },
  parts: (merged): Promise<PartValue[]> => {
    return Promise.resolve(
      metadataToParts(unflattenMetadata(merged), { assigned: true }),
    );
  },
  prepare: async (values, keys) => {
    for (const key of keys) {
      const value = values[key];
      if (key.startsWith(IMAGE) && typeof value === "string")
        await putImage(value);
    }
  },
  apply: (data, values, keys) => {
    applyImages(data, values, keys);
    return [
      ...applyOrders(data, values, keys),
      ...applyAssigned(data, values, keys),
    ];
  },
};
