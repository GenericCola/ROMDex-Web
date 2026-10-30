import { reviewedTicketIds } from "./ticket-locks";
import type { WorkspaceData } from "./types";
import { workspaceStore } from "./workspace-store";
export const taskEditingLocked = (id?: string, data?: WorkspaceData) => {
  const state = workspaceStore.getSnapshot();
  if (state.error) return true;
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
