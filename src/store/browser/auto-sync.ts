import { workspaceStore } from "@/domain/workspace-store";

const TIMER_MS = 5 * 60 * 1000;
const SETTLE_MS = 5000;

/**
 * Syncs soon after start, when the browser comes back online, a few seconds
 * after the workspace changes, and every five minutes. Answers a stop function.
 */
export const autoSync = (syncAll: () => Promise<void>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void syncAll();
    }, SETTLE_MS);
  };
  const online = () => {
    void syncAll();
  };
  let last = workspaceStore.getSnapshot().data;
  const changed = () => {
    const { data } = workspaceStore.getSnapshot();
    if (data === last) return;
    last = data;
    soon();
  };
  window.addEventListener("online", online);
  const unsubscribe = workspaceStore.subscribe(changed);
  const interval = setInterval(online, TIMER_MS);
  soon();
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    unsubscribe();
    window.removeEventListener("online", online);
  };
};
