import { subscribeDraftEditors } from "@/domain/editor-drafts";
import { subscribeTaskEditing } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { incomingFailureMessage, IncomingSuperseded } from "./incoming-error";
import type { IncomingMode } from "./incoming-refresh";
import { incomingContext, refreshIncoming } from "./incoming-refresh";
import { setIncomingMessage } from "./incoming-status";
import { subscribeRefresh } from "./refresh-request";
const RANK: Record<IncomingMode, number> = { cached: 0, check: 1, full: 2 };
/*
 * Reads YouTrack only when something suggests it changed: on connecting, when
 * the window comes back into view or online, after this window's delivery
 * finished, and on Refresh. Editor and queue changes re-apply the last read
 * without a request. There is no timer that reads on its own.
 */
export const watchIncoming = () => {
  let alive = true,
    busy = false,
    wanted: IncomingMode | null = null;
  let connection: unknown;
  let holds = "",
    epoch = workspaceStore.deliveryEpoch();
  let settle: ReturnType<typeof setTimeout> | undefined;
  const visible = () => {
    return document.visibilityState !== "hidden";
  };
  const request = (mode: IncomingMode) => {
    if (!wanted || RANK[mode] > RANK[wanted]) wanted = mode;
    void run();
  };
  const run = async () => {
    if (!alive || busy || !wanted) return;
    if (!visible() || !incomingContext()) return;
    const mode = wanted;
    wanted = null;
    busy = true;
    try {
      await refreshIncoming(mode, () => {
        return alive;
      });
      if (alive) setIncomingMessage("");
    } catch (error) {
      // A superseded read is checked again; a failure waits for the next event.
      if (error instanceof IncomingSuperseded) request("check");
      else if (alive && incomingContext())
        setIncomingMessage(incomingFailureMessage(error));
    } finally {
      busy = false;
      if (alive && wanted) void run();
    }
  };
  const shown = () => {
    if (visible()) request("check");
  };
  const reapply = () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      request("cached");
    }, 250);
  };
  const changed = () => {
    const state = workspaceStore.getSnapshot();
    const nextHolds = JSON.stringify([
      state.data.operations.map((op) => {
        return op.opId;
      }),
      Object.entries(state.data.cloud?.records ?? {}).map(([id, record]) => {
        return [id, record.status];
      }),
      state.data.titleDrafts,
      state.data.commentDrafts,
      state.data.newTask,
      state.data.view.renameId,
      [...workspaceStore.deliveryTickets()],
    ]);
    if (nextHolds !== holds) {
      holds = nextHolds;
      reapply();
    }
    // A finished delivery may have changed issues (ours, or YouTrack rules).
    const nextEpoch = workspaceStore.deliveryEpoch();
    if (nextEpoch !== epoch && !state.delivering) {
      epoch = nextEpoch;
      request("check");
    }
    const client = incomingContext()?.client;
    if (client !== connection) {
      connection = client;
      if (client) request("full");
      else setIncomingMessage("");
    }
  };
  const full = () => {
    request("full");
  };
  const stops = [
    workspaceStore.subscribe(changed),
    subscribeDraftEditors(reapply),
    subscribeTaskEditing(reapply),
    subscribeRefresh(full),
  ];
  window.addEventListener("focus", shown);
  window.addEventListener("online", shown);
  document.addEventListener("visibilitychange", shown);
  changed();
  return () => {
    alive = false;
    clearTimeout(settle);
    for (const stop of stops) stop();
    window.removeEventListener("focus", shown);
    window.removeEventListener("online", shown);
    document.removeEventListener("visibilitychange", shown);
  };
};
