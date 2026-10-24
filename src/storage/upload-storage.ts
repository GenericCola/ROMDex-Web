import type { StoredUpload, UploadStore } from "@/attachments/types";
import {
  MAX_STAGED,
  sameUploadFile,
  verifyUpload,
} from "@/attachments/validate";
export class UploadStorage implements UploadStore {
  private connection: Promise<IDBDatabase> | undefined;
  private open = () => {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("romdex-web-upload-bytes", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("files");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
        };
        resolve(db);
      };
      request.onerror = request.onblocked = () => {
        reject(
          Error("Staged file storage could not open. Keep the original files."),
        );
      };
    });
    return this.connection;
  };
  get = async (id: string) => {
    const db = await this.open();
    const value = await new Promise<StoredUpload | undefined>(
      (resolve, reject) => {
        const request = db.transaction("files").objectStore("files").get(id);
        request.onsuccess = () => {
          resolve(request.result as StoredUpload | undefined);
        };
        request.onerror = () => {
          reject(Error("Staged file could not be read."));
        };
      },
    );
    if (value && value.id !== id) throw Error("Staged file identity differs.");
    return value ? verifyUpload(value) : undefined;
  };
  put = async (value: StoredUpload) => {
    await verifyUpload(value);
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite", { durability: "strict" }),
        store = tx.objectStore("files"),
        request = store.getAll();
      let reason = "Staged file could not be saved. Keep the original file.";
      request.onsuccess = () => {
        const current = request.result as StoredUpload[],
          existing = current.find((record) => {
            return record.id === value.id;
          });
        if (existing && !sameUploadFile(existing.file, value.file)) {
          reason =
            "A different staged file already uses this upload ID. Both source files are unchanged.";
          tx.abort();
          return;
        }
        const bytes = current.reduce((sum, record) => {
          return sum + (record.id === value.id ? 0 : record.file.size);
        }, value.file.size);
        if (bytes > MAX_STAGED) {
          reason =
            "Staged files exceed 64 MiB. Finish delivery, cancel unsent files, or export recovery and remove archived staged copies before adding more.";
          tx.abort();
          return;
        }
        store.put(value, value.id);
      };
      tx.oncomplete = () => {
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        reject(Error(reason));
      };
    });
  };
  remove = async (id: string) => {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite", { durability: "strict" });
      tx.objectStore("files").delete(id);
      tx.oncomplete = () => {
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        reject(Error("Confirmed file cache cleanup failed."));
      };
    });
  };
}
export const uploadStorage = new UploadStorage();
