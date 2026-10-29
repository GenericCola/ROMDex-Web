import type { WorkspaceData } from "@/domain/types";
import { validateWorkspace } from "@/domain/workspace-data";
interface WorkspaceRecord {
  revision: number;
  data: WorkspaceData;
}
export class WorkspaceStorage {
  constructor(private key = "current") {
    if (!key || key.length > 2048) throw Error("Invalid workspace key.");
  }
  private connection: Promise<IDBDatabase> | undefined;
  private open = (): Promise<IDBDatabase> => {
    this.connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("romdex-web-workspace", 1);
      const upgrade = () => {
        return request.result.createObjectStore("workspace");
      };
      const success = () => {
        const db = request.result;
        db.onversionchange = () => {
          return db.close();
        };
        resolve(db);
      };
      const failure = () => {
        return reject(
          Error(
            "Browser storage could not open. No existing data was replaced.",
          ),
        );
      };
      request.onupgradeneeded = upgrade;
      request.onsuccess = success;
      request.onerror = failure;
      request.onblocked = failure;
    });
    return this.connection;
  };
  load = async (): Promise<WorkspaceRecord | undefined> => {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("workspace")
        .objectStore("workspace")
        .get(this.key);
      const success = () => {
        try {
          const record = request.result as WorkspaceRecord | undefined;
          if (record) {
            validateWorkspace(record.data);
            if (!Number.isSafeInteger(record.revision) || record.revision < 0)
              throw Error("Invalid workspace revision.");
          }
          resolve(record);
        } catch (error) {
          reject(
            error instanceof Error ? error : Error("Invalid workspace record."),
          );
        }
      };
      const failure = () => {
        return reject(
          Error(
            "Browser storage could not read your workspace. No data was replaced.",
          ),
        );
      };
      request.onsuccess = success;
      request.onerror = failure;
    });
  };
  save = async (
    data: WorkspaceData,
    expectedRevision: number,
  ): Promise<number> => {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite", {
        durability: "strict",
      });
      let reason =
        "Browser storage could not save. Keep this window open and export a recovery copy.";
      const store = tx.objectStore("workspace");
      const request = store.get(this.key);
      const checked = () => {
        const record = request.result as WorkspaceRecord | undefined;
        if ((record?.revision ?? 0) !== expectedRevision) {
          reason =
            "Another ROMDex window saved first. Export a recovery copy before reloading this window.";
          tx.abort();
          return;
        }
        store.put({ revision: expectedRevision + 1, data }, this.key);
      };
      const complete = () => {
        return resolve(expectedRevision + 1);
      };
      const failed = () => {
        return reject(Error(reason));
      };
      request.onsuccess = checked;
      tx.oncomplete = complete;
      tx.onerror = failed;
      tx.onabort = failed;
    });
  };
}
