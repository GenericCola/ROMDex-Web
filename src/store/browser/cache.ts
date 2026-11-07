import { openDatabase } from "@/storage/open-database";
import type { BlobCache } from "../core/read.ts";
import type { StoreName } from "../parts/manifest.ts";

export interface ReviewItem {
  key: string;
  local?: unknown;
  remote?: unknown;
  remoteWrittenAt: string;
  remoteWrittenBy: string;
  at: string;
}

export interface StoreBase {
  revision: number;
  writeId: string;
  values: Record<string, unknown>;
}

export interface StoreState {
  articleId?: string;
  base?: StoreBase;
  /** Local values differ from base (waiting to sync). */
  pending: boolean;
  refused: { key: string; name: string; size: number; message: string }[];
  review: ReviewItem[];
  lastSync?: string;
  lastError?: string;
}

export interface RecoveryEntry {
  at: string;
  scope: string;
  store: StoreName;
  key: string;
  local?: unknown;
  remote?: unknown;
  reason: "conflict" | "kept-youtrack" | "kept-mine";
}

type StoreArea = "state" | "blobs" | "recovery";

const emptyState = (): StoreState => {
  return { pending: false, refused: [], review: [] };
};

/*
 * Browser-side store memory. Records are only ever written, never deleted:
 * recovery entries in particular are append-only.
 */
export class StoreCache {
  constructor(private name = "romdex-web-store") {}
  private connection: Promise<IDBDatabase> | undefined;
  private open = (): Promise<IDBDatabase> => {
    this.connection ??= openDatabase(
      this.name,
      1,
      (db) => {
        db.createObjectStore("state");
        db.createObjectStore("blobs");
        db.createObjectStore("recovery", { autoIncrement: true });
      },
      "Browser storage could not open. No store data was replaced.",
    );
    return this.connection;
  };
  private run = async <T>(
    area: StoreArea,
    write: boolean,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> => {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = write
        ? db.transaction(area, "readwrite", { durability: "strict" })
        : db.transaction(area);
      const request = action(tx.objectStore(area));
      const complete = () => {
        return resolve(request.result as T);
      };
      const failed = () => {
        return reject(Error("Browser storage could not save the store data."));
      };
      tx.oncomplete = complete;
      tx.onerror = failed;
      tx.onabort = failed;
    });
  };
  getState = async (scope: string, store: StoreName): Promise<StoreState> => {
    const found = await this.run<StoreState | undefined>(
      "state",
      false,
      (area) => {
        return area.get(JSON.stringify([scope, store]));
      },
    );
    return found ?? emptyState();
  };
  putState = async (
    scope: string,
    store: StoreName,
    state: StoreState,
  ): Promise<void> => {
    await this.run("state", true, (area) => {
      return area.put(state, JSON.stringify([scope, store]));
    });
  };
  blobCache = (): BlobCache => {
    return {
      get: async (sha256) => {
        const bytes = await this.run<Uint8Array | undefined>(
          "blobs",
          false,
          (area) => {
            return area.get(sha256);
          },
        );
        return bytes ? new Uint8Array(bytes) : undefined;
      },
      put: async (sha256, bytes) => {
        await this.run("blobs", true, (area) => {
          return area.put(bytes, sha256);
        });
      },
    };
  };
  addRecovery = async (entry: RecoveryEntry): Promise<void> => {
    await this.run("recovery", true, (area) => {
      return area.add(entry);
    });
  };
  listRecovery = async (scope: string): Promise<RecoveryEntry[]> => {
    const all = await this.run<RecoveryEntry[]>("recovery", false, (area) => {
      return area.getAll();
    });
    return all.filter((entry) => {
      return entry.scope === scope;
    });
  };
}
