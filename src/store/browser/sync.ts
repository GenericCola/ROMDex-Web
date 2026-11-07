import type { WorkspaceData, WorkspaceSnapshot } from "@/domain/types";
import { findArticle, readArticle } from "@/store/core/article";
import { readStore } from "@/store/core/read";
import type { StoreTarget, StoreTransport } from "@/store/core/transport";
import type { CommitResult } from "@/store/core/write";
import { commitStore } from "@/store/core/write";
import type { FlatValues, MergeResult } from "@/store/merge/merge";
import { mergeValues, sameValue } from "@/store/merge/merge";
import type { StoreBinding } from "./binding";
import type { StoreCache, StoreState } from "./cache";
import { recordConflicts } from "./review";
import { nextBase } from "./sync-base";

/*
 * One sync of one store (design section 3, "One sync"): read the article,
 * merge each key three ways against the last-synced base, write what changed,
 * then apply YouTrack's changes to this browser's workspace.
 */

export interface SyncWorkspace {
  getSnapshot: () => WorkspaceSnapshot;
  change: (update: (data: WorkspaceData) => void) => Promise<void>;
}

export interface SyncDeps {
  transport: StoreTransport;
  cache: StoreCache;
  /** Instance user and project the base belongs to. */
  scope: string;
  /** YouTrack user id of this browser's user. */
  writtenBy: string;
  target: StoreTarget;
  workspace: SyncWorkspace;
}

export type SyncOutcome =
  | { kind: "synced"; state: StoreState; written: boolean }
  | { kind: "not-set-up" }
  | { kind: "ambiguous"; ids: string[] }
  | { kind: "waiting"; reason: string }
  | { kind: "busy" };

const ATTEMPTS = 3;

const blocked = (snapshot: WorkspaceSnapshot, binding: StoreBinding) => {
  if (!snapshot.ready) return "Wait for your workspace to open.";
  if (snapshot.error) return "Local saving failed; sync waits for it.";
  if (snapshot.delivering || snapshot.updating)
    return "Sync waits for delivery or the app update to finish.";
  return binding.ready(snapshot.data);
};

/** Applies YouTrack's changes; answers the keys left for a later sync. */
const applyRemote = async (
  deps: SyncDeps,
  binding: StoreBinding,
  result: MergeResult,
  seen: { base: FlatValues | null; local: FlatValues; remote: FlatValues },
  remoteParts: Parameters<StoreBinding["apply"]>[3],
) => {
  if (!result.toLocal.length) return [];
  let later = [...result.toLocal];
  try {
    await deps.workspace.change((data) => {
      const now = binding.local(data, seen.base, seen.remote);
      // A key edited here while the sync ran keeps that edit.
      const keys = result.toLocal.filter((key) => {
        return sameValue(now[key], seen.local[key]);
      });
      const held = binding.apply(data, result.merged, keys, remoteParts);
      later = result.toLocal.filter((key) => {
        return !keys.includes(key) || held.includes(key);
      });
    });
  } catch {
    // Delivery or an update started: nothing applied, the next sync retries.
    return [...result.toLocal];
  }
  return later;
};

/** True when this browser holds nothing YouTrack's copy lacks. */
const nothingToSend = (
  deps: SyncDeps,
  binding: StoreBinding,
  state: StoreState,
) => {
  if (!state.base || state.pending || state.review.length) return false;
  const base = state.base.values;
  const local = binding.local(deps.workspace.getSnapshot().data, base, base);
  return mergeValues(base, local, base).toRemote.length === 0;
};

/**
 * One sync. With `onlyLocal`, a sync started by a local change sends no
 * request when that change did not touch anything this store holds.
 */
export const syncStore = async (
  deps: SyncDeps,
  binding: StoreBinding,
  onlyLocal = false,
): Promise<SyncOutcome> => {
  const reason = blocked(deps.workspace.getSnapshot(), binding);
  if (reason) return { kind: "waiting", reason };
  const state = await deps.cache.getState(deps.scope, binding.store);
  if (onlyLocal && nothingToSend(deps, binding, state))
    return { kind: "synced", state, written: false };
  const found = await findArticle(deps.transport, deps.target, state.articleId);
  if (found.kind === "missing") return { kind: "not-set-up" };
  if (found.kind === "ambiguous") return found;
  let { article } = found;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) {
      const fresh = await readArticle(deps.transport, article.id);
      if (!fresh) throw Error(`${article.idReadable} can no longer be read.`);
      article = fresh;
    }
    const snapshot = await readStore(
      deps.transport,
      article,
      binding.store,
      deps.cache.blobCache(),
    );
    const remote = binding.remote(snapshot.parts);
    const base = state.base?.values ?? null;
    const local = binding.local(
      deps.workspace.getSnapshot().data,
      base,
      remote,
    );
    const result = mergeValues(base, local, remote);
    const commit: CommitResult = result.toRemote.length
      ? await commitStore(deps.transport, {
          base: snapshot,
          parts: await binding.parts(
            result.merged,
            snapshot.parts,
            deps.workspace.getSnapshot().data,
          ),
          writtenBy: deps.writtenBy,
        })
      : { kind: "unchanged", manifest: snapshot.manifest, refused: [] };
    if (commit.kind === "moved" || commit.kind === "lost") continue;
    const later = await applyRemote(
      deps,
      binding,
      result,
      { base, local, remote },
      snapshot.parts,
    );
    const next: StoreState = {
      ...state,
      articleId: article.id,
      base: {
        revision: commit.manifest.revision,
        writeId: commit.manifest.writeId,
        values: nextBase(base, result, remote, commit, later),
      },
      pending: commit.refused.length > 0,
      refused: commit.refused,
      lastSync: new Date().toISOString(),
    };
    delete next.lastError;
    await recordConflicts(deps, binding.store, next, result, snapshot.manifest);
    await deps.cache.putState(deps.scope, binding.store, next);
    return { kind: "synced", state: next, written: commit.kind === "written" };
  }
  return { kind: "busy" };
};
