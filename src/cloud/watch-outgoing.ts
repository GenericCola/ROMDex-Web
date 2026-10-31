import { subscribeDraftEditors } from "@/domain/editor-drafts";
import { subscribeTaskEditing } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { automaticBatch } from "./automatic-batch";
import { startOutgoingScheduler } from "./outgoing-scheduler";
import {
  automaticDelivery,
  deliveryConnected,
  deliveryPaused,
} from "./session";
import { cloudData } from "./types";
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
    (!state.data.operations.length &&
      !cloud.rollupPending &&
      !cloud.sharedStatuses)
  )
    return null;
  const selected = automaticBatch(state.data);
  if (selected && !selected.size) return null;
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
      const stops = [
        workspaceStore.subscribe(changed),
        subscribeDraftEditors(changed),
        subscribeTaskEditing(changed),
      ];
      return () => {
        for (const stop of stops) stop();
      };
    },
  );
};
