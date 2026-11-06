import type { MergeResult } from "@/store/merge/merge";
import type { StoreManifest, StoreName } from "@/store/parts/manifest";
import type { StoreBinding } from "./binding";
import type { ReviewItem, StoreState } from "./cache";
import type { SyncDeps } from "./sync";

/*
 * Conflicts: both sides changed a key differently since the base. YouTrack's
 * value stays in the article and in this browser; this browser's value goes
 * to the review list and to the recovery history, which is never cleared.
 */

export const recordConflicts = async (
  deps: Pick<SyncDeps, "cache" | "scope">,
  store: StoreName,
  state: StoreState,
  result: MergeResult,
  manifest: StoreManifest,
) => {
  const at = new Date().toISOString();
  for (const conflict of result.conflicts) {
    const item: ReviewItem = {
      key: conflict.key,
      remoteWrittenAt: manifest.writtenAt,
      remoteWrittenBy: manifest.writtenBy,
      at,
    };
    if (Object.hasOwn(conflict, "local")) item.local = conflict.local;
    if (Object.hasOwn(conflict, "remote")) item.remote = conflict.remote;
    state.review = [
      ...state.review.filter((old) => {
        return old.key !== item.key;
      }),
      item,
    ];
    await deps.cache.addRecovery({
      at,
      scope: deps.scope,
      store,
      key: item.key,
      ...(Object.hasOwn(item, "local") ? { local: item.local } : {}),
      ...(Object.hasOwn(item, "remote") ? { remote: item.remote } : {}),
      reason: "conflict",
    });
  }
};

/**
 * Settles one reviewed key. "mine" puts this browser's value back into the
 * workspace, so the next sync sends it; "youtrack" keeps what is there.
 */
export const settleReview = async (
  deps: Pick<SyncDeps, "cache" | "scope" | "workspace">,
  binding: StoreBinding,
  key: string,
  choice: "mine" | "youtrack",
) => {
  const state = await deps.cache.getState(deps.scope, binding.store);
  const item = state.review.find((entry) => {
    return entry.key === key;
  });
  if (!item) return;
  if (choice === "mine")
    await deps.workspace.change((data) => {
      const values = Object.hasOwn(item, "local") ? { [key]: item.local } : {};
      const held = binding.apply(data, values, [key], []);
      if (held.length)
        throw Error("This value cannot be restored yet. Try again later.");
    });
  await deps.cache.addRecovery({
    at: new Date().toISOString(),
    scope: deps.scope,
    store: binding.store,
    key,
    ...(Object.hasOwn(item, "local") ? { local: item.local } : {}),
    ...(Object.hasOwn(item, "remote") ? { remote: item.remote } : {}),
    reason: choice === "mine" ? "kept-mine" : "kept-youtrack",
  });
  await deps.cache.putState(deps.scope, binding.store, {
    ...state,
    review: state.review.filter((entry) => {
      return entry.key !== key;
    }),
  });
};
