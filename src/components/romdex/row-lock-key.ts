import { recoveryMode } from "@/auth/recovery-mode";
import { reviewedTicketIds } from "@/domain/ticket-locks";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
export interface RowLockInputs {
  error: string;
  updating: boolean;
  recovery: boolean;
  reviewed: Iterable<string>;
  delivery: Iterable<string>;
}
const sorted = (ids: Iterable<string>) => {
  return [...ids].sort().join(",");
};
// Everything the row children read at render time through global readers
// (taskEditingLocked, uploadStagingLocked), folded into one comparable string.
export const lockKeyOf = (inputs: RowLockInputs) => {
  return JSON.stringify([
    inputs.error,
    inputs.updating,
    inputs.recovery,
    sorted(inputs.reviewed),
    sorted(inputs.delivery),
  ]);
};
export const rowLockKey = (data: WorkspaceData) => {
  const state = workspaceStore.getSnapshot();
  return lockKeyOf({
    error: state.error,
    updating: state.updating,
    recovery: recoveryMode(),
    reviewed: reviewedTicketIds(data),
    delivery: workspaceStore.deliveryTickets(),
  });
};
