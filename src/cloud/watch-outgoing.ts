import { subscribeDraftEditors } from "@/domain/editor-drafts";
import { subscribeTaskEditing } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { automaticBatch } from "./automatic-batch";
import { startOutgoingScheduler } from "./outgoing-scheduler";
import {
  automaticDelivery,
  deliveryConnected,
  deliveryPaused,
  uploadRecoveryDue,
} from "./session";
import { cloudData } from "./types";
import { statusReadNeeded } from "./unavailable-tasks";
const outgoingWork = () => {
  const state = workspaceStore.getSnapshot(),
    cloud = cloudData(state.data);
  if (
    !state.ready ||
    state.pendingWrites ||
    state.error ||
    state.updating ||
    state.delivering ||
    !deliveryConnected() ||
    deliveryPaused() ||
    !cloud.autoSync ||
    (!state.data.operations.length && !statusReadNeeded(state.data))
  )
    return null;
  const selected = automaticBatch(state.data);
  if (selected && !selected.size && !uploadRecoveryDue()) return null;
  return JSON.stringify([
    state.data.operations.filter((op) => {
      return !selected || selected.has(op.opId);
    }),
    cloud.rollupPending,
    cloud.records,
  ]);
};
export const watchOutgoing = () => {
  return startOutgoingScheduler(
    outgoingWork,
    async () => {
      await automaticDelivery();
    },
    (changed) => {
      const readbackTimer = setInterval(changed, 60_000);
      const stops = [
        workspaceStore.subscribe(changed),
        subscribeDraftEditors(changed),
        subscribeTaskEditing(changed),
      ];
      return () => {
        clearInterval(readbackTimer);
        for (const stop of stops) stop();
      };
    },
  );
};
