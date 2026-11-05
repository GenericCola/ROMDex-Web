import { cloudData } from "@/cloud/types";
import type { WorkspaceSnapshot } from "@/domain/types";
export const SAVE_ATTENTION_AFTER = 10 * 60_000;
export const pendingSaveKeys = (state: WorkspaceSnapshot, drafts: boolean) => {
  const keys = new Set(
    state.data.operations.map((op) => {
      return "operation:" + op.opId;
    }),
  );
  if (drafts) keys.add("editor-drafts");
  if (state.pendingWrites) keys.add("local-writes");
  for (const id of Object.keys(state.data.titleDrafts)) keys.add("title:" + id);
  for (const id of Object.keys(state.data.commentDrafts))
    keys.add("comment:" + id);
  if (cloudData(state.data).rollupPending) keys.add("parent-status");
  return keys;
};
export const saveOverdue = (
  ages: Map<string, number>,
  keys: Set<string>,
  now: number,
) => {
  for (const key of ages.keys()) if (!keys.has(key)) ages.delete(key);
  for (const key of keys) if (!ages.has(key)) ages.set(key, now);
  return [...ages.values()].some((started) => {
    return now - started >= SAVE_ATTENTION_AFTER;
  });
};
