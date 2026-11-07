import type {
  WorkspaceData,
  WorkspaceSnapshot,
} from "../../src/domain/types.ts";
import { emptyWorkspace } from "../../src/domain/workspace-data.ts";
import { StoreCache } from "../../src/store/browser/cache.ts";
import type { SyncDeps, SyncWorkspace } from "../../src/store/browser/sync.ts";
import { createArticle } from "../../src/store/core/article.ts";
import { STORE_TARGETS } from "../../src/store/core/transport.ts";
import { FakeYouTrackStore } from "./fake-youtrack-store.tsx";
import { storeIndexedDb } from "./store-idb.tsx";
import { taskItem } from "./task-item.ts";

export const SCOPE = "instance|2-1";

export const item = taskItem;

/** PMON-1 with children PMON-2, PMON-3 and PMON-4. */
export const taskData = (): WorkspaceData => {
  const data = emptyWorkspace();
  data.remote = [
    item("PMON-1"),
    item("PMON-2", "PMON-1"),
    item("PMON-3", "PMON-1"),
    item("PMON-4", "PMON-1"),
  ];
  data.cloud = { assigned: {} } as never;
  return data;
};

export interface Device {
  snapshot: WorkspaceSnapshot;
  workspace: SyncWorkspace;
  cache: StoreCache;
  deps: (
    fake: FakeYouTrackStore,
    store?: "romdex-metadata" | "npcdex",
  ) => SyncDeps;
}

export const device = (name: string, data = taskData()): Device => {
  const snapshot: WorkspaceSnapshot = {
    ready: true,
    updating: false,
    delivering: false,
    data,
    pendingWrites: 0,
    error: "",
    connection: "",
  };
  const workspace: SyncWorkspace = {
    getSnapshot: () => {
      return snapshot;
    },
    change: (update) => {
      update(snapshot.data);
      return Promise.resolve();
    },
  };
  const cache = new StoreCache(name);
  return {
    snapshot,
    workspace,
    cache,
    deps: (fake, store = "romdex-metadata") => {
      return {
        transport: fake,
        cache,
        scope: SCOPE,
        writtenBy: name,
        target: STORE_TARGETS[store],
        workspace,
      };
    },
  };
};

/** Runs with a fresh in-memory IndexedDB installed. */
export const withIdb = async (run: () => Promise<void>) => {
  const old = globalThis.indexedDB;
  globalThis.indexedDB = storeIndexedDb();
  try {
    await run();
  } finally {
    globalThis.indexedDB = old;
  }
};

/** A fake YouTrack with one ROMDex and one NPCDex article. */
export const twoArticles = async () => {
  const fake = new FakeYouTrackStore();
  const romdex = await createArticle(
    fake,
    STORE_TARGETS["romdex-metadata"],
    "2-1",
  );
  const npcdex = await createArticle(fake, STORE_TARGETS.npcdex, "2-1");
  fake.calls.length = 0;
  return { fake, romdex, npcdex };
};
