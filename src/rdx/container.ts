import { canonical } from "@/domain/accepted/content/contracts.mjs";
import { packRdx, unpackRdx } from "@/domain/accepted/rdx/container.mjs";
import { documentRevision } from "@/domain/accepted/rdx/document.mjs";
import type { JsonObject } from "@/domain/json";
import { Buffer } from "buffer/index.js";
const limits = { stored: 64 * 1024 * 1024, decoded: 128 * 1024 * 1024 };
export const readRdx = async (bytes: Uint8Array, signal?: AbortSignal) => {
  return unpackRdx(Buffer.from(bytes), {
    limits,
    ...(signal ? { signal } : {}),
  });
};
export const writeRdx = async (
  document: JsonObject,
  blobs: Map<string, Uint8Array>,
  signal?: AbortSignal,
) => {
  const encoded = new Map(
    [...blobs].map(([hash, bytes]) => {
      return [hash, Buffer.from(bytes)] as const;
    }),
  );
  return packRdx(Buffer.from(canonical(document)), encoded, {
    limits,
    ...(signal ? { signal } : {}),
  });
};
export { documentRevision };
