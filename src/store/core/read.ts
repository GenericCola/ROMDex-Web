import type { PartValue } from "../parts/files.ts";
import { decodePart } from "../parts/files.ts";
import type { StoreManifest, StoreName } from "../parts/manifest.ts";
import { readManifest } from "../parts/manifest.ts";
import type { StoreArticle } from "./article.ts";
import { readAttachment } from "./attachments.ts";
import type { StoreTransport } from "./transport.ts";

/** Downloaded part bytes keyed by their SHA-256, so unchanged parts are not fetched again. */
export interface BlobCache {
  get: (sha256: string) => Promise<Uint8Array | undefined>;
  put: (sha256: string, bytes: Uint8Array) => Promise<void>;
}

export interface StoreSnapshot {
  article: StoreArticle;
  manifest: StoreManifest;
  parts: PartValue[];
  /** Parts kept somewhere this app cannot read; the store must not be written. */
  unavailable: string[];
}

/** The manifest in an article, or a clear reason why it cannot be used. */
export const articleManifest = (
  article: StoreArticle,
  store: StoreName,
): StoreManifest => {
  const read = readManifest(article.content, store);
  switch (read.kind) {
    case "ok":
      return read.manifest;
    case "newer":
      throw Error(
        `${article.idReadable} was written by a newer ROMDex (format ${read.version}). Update ROMDex to sync it.`,
      );
    case "other-store":
      throw Error(
        `${article.idReadable} holds "${read.store}", not "${store}".`,
      );
    case "missing":
      throw Error(`${article.idReadable} has no ROMDex manifest.`);
    case "invalid":
      throw Error(
        `${article.idReadable} has a damaged manifest: ${read.reason}`,
      );
  }
};

const partBytes = async (
  transport: StoreTransport,
  article: StoreArticle,
  key: string,
  file: StoreManifest["files"][string],
  cache?: BlobCache,
) => {
  const cached = await cache?.get(file.sha256);
  if (cached) return cached;
  const attachment = await readAttachment(transport, article.id, file.id);
  if (
    !attachment?.url ||
    attachment.name !== file.name ||
    attachment.size !== file.size
  )
    throw Error(
      `The stored file for "${key}" is missing or changed in ${article.idReadable}.`,
    );
  return transport.download(attachment.url, file.size, {
    article: article.id,
    id: file.id,
  });
};

/** Reads the manifest and every part, checking each part's size and SHA-256. */
export const readStore = async (
  transport: StoreTransport,
  article: StoreArticle,
  store: StoreName,
  cache?: BlobCache,
): Promise<StoreSnapshot> => {
  const manifest = articleManifest(article, store);
  const parts: PartValue[] = [];
  const unavailable: string[] = [];
  for (const [key, file] of Object.entries(manifest.files)) {
    if (file.where !== "youtrack") {
      unavailable.push(key);
      continue;
    }
    const bytes = await partBytes(transport, article, key, file, cache);
    // decodePart checks size and SHA-256 before unzipping.
    parts.push(await decodePart(key, file, bytes));
    await cache?.put(file.sha256, bytes);
  }
  return { article, manifest, parts, unavailable };
};
