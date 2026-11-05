import { recoveryMode } from "@/auth/recovery-mode";
import { reviewedTicketIds } from "./ticket-locks";
import type { WorkspaceData } from "./types";
import { canStageAlongsideUploads } from "./upload-staging";
import { workspaceStore } from "./workspace-store";
export const uploadStagingLocked = (id: string) => {
  const state = workspaceStore.getSnapshot();
  return (
    !!state.error ||
    state.updating ||
    recoveryMode() ||
    (taskEditingLocked(id) && !canStageAlongsideUploads(state.data, id))
  );
};
export const taskEditingLocked = (id?: string, data?: WorkspaceData) => {
  const state = workspaceStore.getSnapshot();
  if (state.error || recoveryMode()) return true;
  const ids = reviewedTicketIds(data ?? state.data);
  for (const ticket of workspaceStore.deliveryTickets()) ids.add(ticket);
  return ids.has("*") || (id ? ids.has(id) : ids.size > 0);
};
export const previewRequired = (epoch: number, lockedAtStart: boolean) => {
  return (
    lockedAtStart ||
    taskEditingLocked() ||
    epoch !== workspaceStore.deliveryEpoch()
  );
};
