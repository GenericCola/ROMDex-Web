import { subscribeRefresh } from "@/cloud/refresh-request";
import { workspaceStore } from "@/domain/workspace-store";

const SETTLE_MS = 5000;
const FOCUS_GAP_MS = 30_000;

/**
 * Syncs 5 s after start, when the browser comes back online, when the window comes
 * back into view (at most every 30 s), on Refresh, and a few seconds after the workspace
 * changes. There is no timer that re-reads YouTrack on its own. A change-driven
 * sync sends nothing when the change did not touch a synced value. Answers a
 * stop function.
 */
export const autoSync = (
  syncAll: () => Promise<void>,
  syncChanged: () => Promise<void>,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastFull = 0;
  const full = () => {
    lastFull = Date.now();
    void syncAll();
  };
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void syncChanged();
    }, SETTLE_MS);
  };
  const shown = () => {
    if (document.visibilityState === "hidden") return;
    if (Date.now() - lastFull >= FOCUS_GAP_MS) full();
  };
  let last = workspaceStore.getSnapshot().data;
  const changed = () => {
    const { data } = workspaceStore.getSnapshot();
    if (data === last) return;
    last = data;
    soon();
  };
  window.addEventListener("online", full);
  window.addEventListener("focus", shown);
  document.addEventListener("visibilitychange", shown);
  const unsubscribe = workspaceStore.subscribe(changed);
  const stopRefresh = subscribeRefresh(full);
  // The first sync waits for the opening work to settle, as before.
  lastFull = Date.now();
  timer = setTimeout(full, SETTLE_MS);
  return () => {
    clearTimeout(timer);
    unsubscribe();
    stopRefresh();
    window.removeEventListener("online", full);
    window.removeEventListener("focus", shown);
    document.removeEventListener("visibilitychange", shown);
  };
};
