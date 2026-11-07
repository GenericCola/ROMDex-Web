import { authIdentity, authToken, hasAuthSession } from "@/auth/session";
import { workspaceStore } from "@/domain/workspace-store";
import { createArticle } from "@/store/core/article";
import { STORE_TARGETS } from "@/store/core/transport";
import type { StoreName } from "@/store/parts/manifest";
import { errorText } from "@utils/error-text";
import { autoSync } from "./auto-sync";
import type { StoreBinding } from "./binding";
import { StoreCache } from "./cache";
import { npcdexBinding } from "./npcdex-binding";
import { settleReview } from "./review";
import { romdexBinding } from "./romdex-binding";
import type { StoreStatus } from "./status";
import { offlineMessage, outcomeStatus, statusOf, STORES } from "./status";
import type { SyncDeps } from "./sync";
import { syncStore } from "./sync";
import { sessionTransport } from "./transport";
import { withLock } from "./with-lock";

/*
 * Runs store syncs one at a time per browser tab (and across tabs through Web
 * Locks): on start, when the browser comes online or the window comes back
 * into view, a while after the workspace changes, and on request. Publishes a status per store.
 */

const BINDINGS: Record<StoreName, StoreBinding> = {
  "romdex-metadata": romdexBinding,
  npcdex: npcdexBinding,
};

export class StoreSyncController {
  private cache = new StoreCache();
  private queue: Promise<void> = Promise.resolve();
  private statuses = Object.fromEntries(
    STORES.map((store) => {
      return [store, statusOf(store, "idle", "")];
    }),
  ) as Record<StoreName, StoreStatus>;
  private listeners = new Set<() => void>();
  getSnapshot = () => {
    return this.statuses;
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish = (store: StoreName, status: StoreStatus) => {
    this.statuses = { ...this.statuses, [store]: status };
    for (const listener of this.listeners) listener();
  };
  private deps = (store: StoreName): SyncDeps | null => {
    if (!hasAuthSession()) return null;
    const { userId, projectId } = authIdentity();
    return {
      transport: sessionTransport(authToken()),
      cache: this.cache,
      scope: JSON.stringify([userId, projectId]),
      writtenBy: userId,
      target: STORE_TARGETS[store],
      workspace: workspaceStore,
    };
  };
  /** Runs one job for a store after any job already queued. */
  private run = (store: StoreName, job: (deps: SyncDeps) => Promise<void>) => {
    const step = async () => {
      const deps = this.deps(store);
      if (!deps) {
        this.publish(store, statusOf(store, "off", "Sign in to sync."));
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const state = await deps.cache.getState(deps.scope, store);
        this.publish(store, {
          ...statusOf(store, "waiting", offlineMessage),
          review: state.review,
          refused: state.refused,
        });
        return;
      }
      try {
        await withLock("romdex-store-" + store, () => {
          return job(deps);
        });
      } catch (error) {
        const state = await deps.cache.getState(deps.scope, store);
        const message = errorText(error, "Sync failed.");
        await deps.cache.putState(deps.scope, store, {
          ...state,
          lastError: message,
        });
        this.publish(store, {
          ...statusOf(store, "error", message),
          review: state.review,
          refused: state.refused,
        });
      }
    };
    this.queue = this.queue.then(step);
    return this.queue;
  };
  sync = (store: StoreName, onlyLocal = false) => {
    return this.run(store, async (deps) => {
      this.publish(store, {
        ...this.statuses[store],
        kind: "syncing",
        message: "Syncing…",
      });
      const outcome = await syncStore(deps, BINDINGS[store], onlyLocal);
      const state = await deps.cache.getState(deps.scope, store);
      this.publish(store, outcomeStatus(store, outcome, state));
    });
  };
  syncAll = async () => {
    for (const store of STORES) await this.sync(store);
  };
  /** Syncs only stores whose synced values changed here. */
  syncChanged = async () => {
    for (const store of STORES) await this.sync(store, true);
  };
  /** Creates the missing article; call only after the user confirmed. */
  create = async (store: StoreName) => {
    await this.run(store, async (deps) => {
      const article = await createArticle(
        deps.transport,
        deps.target,
        deps.writtenBy,
      );
      const state = await deps.cache.getState(deps.scope, store);
      await deps.cache.putState(deps.scope, store, {
        ...state,
        articleId: article.id,
      });
    });
    await this.sync(store);
  };
  /** The owner picked one of several matching articles. */
  choose = async (store: StoreName, id: string) => {
    await this.run(store, async (deps) => {
      const state = await deps.cache.getState(deps.scope, store);
      await deps.cache.putState(deps.scope, store, { ...state, articleId: id });
    });
    await this.sync(store);
  };
  settle = async (
    store: StoreName,
    key: string,
    choice: "mine" | "youtrack",
  ) => {
    await this.run(store, (deps) => {
      return settleReview(deps, BINDINGS[store], key, choice);
    });
    await this.sync(store);
  };
  start = () => {
    return autoSync(this.syncAll, this.syncChanged);
  };
}

export const storeSync = new StoreSyncController();
