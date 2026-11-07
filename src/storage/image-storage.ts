import { sha256 } from "@/domain/bytes";
import { openDatabase } from "@/storage/open-database";

/*
 * Tile images live here, outside the workspace record. The workspace keeps a
 * short ref (`sha256-<hex>` of the data URL); this database keeps the bytes.
 * Entries are never deleted: an unreferenced entry is harmless.
 */

export const IMAGE_REF = /^sha256-[0-9a-f]{64}$/;
export const IMAGE_DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,/;

const urls = new Map<string, string>();
const refs = new Map<string, string>();
const missing = new Set<string>();
let connection: Promise<IDBDatabase> | undefined;
let factory: IDBFactory | undefined;

const open = () => {
  // A failed open is retried next time; a replaced factory gets a new open.
  if (factory !== globalThis.indexedDB) connection = undefined;
  factory = globalThis.indexedDB;
  const retry = (error: unknown) => {
    connection = undefined;
    throw error;
  };
  connection ??= openDatabase(
    "romdex-web-images",
    1,
    (db) => {
      db.createObjectStore("images");
    },
    "Tile image storage could not open. Keep the original images.",
  ).catch(retry);
  return connection;
};

const remember = (ref: string, url: string) => {
  urls.set(ref, url);
  refs.set(url, ref);
  missing.delete(ref);
};

/** The data URL for a workspace image value (a ref or a legacy data URL), or null if unknown. */
export const imageUrl = (value: string | null | undefined) => {
  if (!value) return null;
  return IMAGE_REF.test(value) ? (urls.get(value) ?? null) : value;
};

/** True for a ref whose image is not in this browser's image store. */
export const imageMissing = (value: string | null | undefined) => {
  return !!value && missing.has(value);
};

/** Refs found missing on load; recovery copies list them. */
export const missingImages = () => {
  return [...missing];
};

/** The ref for a data URL already saved by `putImage`; otherwise the value itself (a legacy data URL stays valid). */
export const imageRefOf = (value: string) => {
  return refs.get(value) ?? value;
};

// Both resolve on transaction completion, after the data is committed.
const read = async (ref: string) => {
  const db = await open();
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction("images");
    const request = tx.objectStore("images").get(ref);
    tx.oncomplete = () => {
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      reject(Error("A tile image could not be read."));
    };
  });
};

const write = async (ref: string, url: string) => {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite", { durability: "strict" });
    tx.objectStore("images").put(url, ref);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      reject(Error("A tile image could not be saved. Keep the original."));
    };
  });
};

/** Saves a data URL durably, reads it back, and answers its ref. Safe to repeat. */
export const putImage = async (url: string) => {
  if (!IMAGE_DATA_URL.test(url)) throw Error("Invalid tile image.");
  const known = refs.get(url);
  const ref = known ?? `sha256-${await sha256(new TextEncoder().encode(url))}`;
  await write(ref, url);
  if ((await read(ref)) !== url)
    throw Error("A tile image failed its read-back check. Keep the original.");
  remember(ref, url);
  return ref;
};

/** Loads stored images for the given refs into memory. Answers the refs with no stored image. */
export const loadImages = async (wanted: string[]) => {
  const absent: string[] = [];
  await Promise.all(
    wanted
      .filter((ref) => {
        return !urls.has(ref);
      })
      .map(async (ref) => {
        const value = await read(ref);
        if (typeof value === "string" && IMAGE_DATA_URL.test(value))
          remember(ref, value);
        else {
          absent.push(ref);
          missing.add(ref);
        }
      }),
  );
  return absent;
};

/** Replaces saved data URLs with their refs, in place. */
export const refImages = (images: Record<string, string> | undefined) => {
  for (const [id, value] of Object.entries(images ?? {}))
    if (images) images[id] = imageRefOf(value);
};

/**
 * Saves every data URL among the values of a loose `{ id: value }` object.
 * Callers save image bytes before any workspace change refers to them.
 */
export const putImages = async (images: unknown) => {
  if (typeof images !== "object" || images === null) return;
  for (const value of Object.values(images))
    if (typeof value === "string" && IMAGE_DATA_URL.test(value))
      await putImage(value);
};
