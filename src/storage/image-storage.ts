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
let connection: Promise<IDBDatabase> | undefined;

const open = () => {
  connection ??= openDatabase(
    "romdex-web-images",
    1,
    (db) => {
      db.createObjectStore("images");
    },
    "Tile image storage could not open. Keep the original images.",
  );
  return connection;
};

const remember = (ref: string, url: string) => {
  urls.set(ref, url);
  refs.set(url, ref);
};

/** The data URL for a workspace image value (a ref or a legacy data URL), or null if unknown. */
export const imageUrl = (value: string | null | undefined) => {
  if (!value) return null;
  return IMAGE_REF.test(value) ? (urls.get(value) ?? null) : value;
};

/** The ref for a data URL already saved by `putImage`; otherwise the value itself (a legacy data URL stays valid). */
export const imageRefOf = (value: string) => {
  return refs.get(value) ?? value;
};

const read = async (ref: string) => {
  const db = await open();
  return new Promise<unknown>((resolve, reject) => {
    const request = db.transaction("images").objectStore("images").get(ref);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(Error("A tile image could not be read."));
    };
  });
};

const write = async (ref: string, url: string) => {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite", { durability: "strict" });
    const store = tx.objectStore("images");
    const request = store.get(ref);
    request.onsuccess = () => {
      if (request.result !== url) store.put(url, ref);
    };
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
  const missing: string[] = [];
  await Promise.all(
    wanted
      .filter((ref) => {
        return !urls.has(ref);
      })
      .map(async (ref) => {
        const value = await read(ref);
        if (typeof value === "string" && IMAGE_DATA_URL.test(value))
          remember(ref, value);
        else missing.push(ref);
      }),
  );
  return missing;
};

/** Saves every data URL among the values of a loose `{ id: value }` object. */
export const putImages = async (images: unknown) => {
  if (typeof images !== "object" || images === null) return;
  for (const value of Object.values(images))
    if (typeof value === "string" && IMAGE_DATA_URL.test(value))
      await putImage(value);
};
