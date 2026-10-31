import { subscribeDraftEditors } from "@/domain/editor-drafts";
import { subscribeTaskEditing } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { incomingContext, refreshIncoming } from "./incoming-refresh";
import { setIncomingMessage } from "./incoming-status";
export const watchIncoming = () => {
  let alive = true,
    busy = false,
    force = true,
    delay = 3000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connection: unknown;
  let holds = "";
  const visible = () => {
    return document.visibilityState !== "hidden";
  };
  const schedule = (wait: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void run();
    }, wait);
  };
  const run = async () => {
    if (!alive || busy) return;
    if (!visible() || !incomingContext()) {
      schedule(3000);
      return;
    }
    busy = true;
    const fresh = force;
    force = false;
    try {
      await refreshIncoming(fresh, () => {
        return alive;
      });
      if (alive) setIncomingMessage("");
      delay = 3000;
    } catch {
      delay = Math.min(Math.max(delay * 2, 15000), 60000);
      if (alive && incomingContext())
        setIncomingMessage(
          "Incoming YouTrack updates are delayed. Your local work is kept; checking again automatically.",
        );
    } finally {
      busy = false;
      if (alive) schedule(force ? 250 : delay);
    }
  };
  const focus = () => {
    if (!visible()) return;
    force = true;
    if (!busy) schedule(100);
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
      if (!busy && visible()) schedule(250);
      else if (busy) force = true;
    }
    const client = incomingContext()?.client;
    if (client !== connection) {
      connection = client;
      if (client) focus();
      else setIncomingMessage("");
    }
  };
  const editorChanged = () => {
    if (busy) force = true;
    else if (visible()) schedule(250);
  };
  const stops = [
    workspaceStore.subscribe(changed),
    subscribeDraftEditors(editorChanged),
    subscribeTaskEditing(editorChanged),
  ];
  window.addEventListener("focus", focus);
  window.addEventListener("online", focus);
  document.addEventListener("visibilitychange", focus);
  changed();
  schedule(100);
  return () => {
    alive = false;
    if (timer) clearTimeout(timer);
    for (const stop of stops) stop();
    window.removeEventListener("focus", focus);
    window.removeEventListener("online", focus);
    document.removeEventListener("visibilitychange", focus);
  };
};
