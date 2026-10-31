import { operationTicketIds } from "./ticket-locks";
import type { WorkspaceData } from "./types";
// Lock only operations still belonging to this immutable delivery batch.
export const deliveryTicketLocks = (
  data: WorkspaceData,
  activeOperations: Set<string>,
  includeRollup = true,
) => {
  const tickets = new Set<string>();
  for (const op of data.operations) {
    const rollup = op.type === "edit" && op.purpose === "rollup";
    if (!activeOperations.has(op.opId) && !(rollup && includeRollup)) continue;
    const locked = operationTicketIds(op);
    if (rollup) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of data.remote)
          if (
            item.parentId &&
            locked.has(item.parentId) &&
            !locked.has(item.id)
          ) {
            locked.add(item.id);
            changed = true;
          }
      }
    }
    for (const id of locked) tickets.add(id);
  }
  return tickets;
};

export const batchOperationIds = (
  data: WorkspaceData,
  selected?: Set<string>,
) => {
  return new Set(
    data.operations
      .filter((op) => {
        return !selected || selected.has(op.opId);
      })
      .flatMap((op) => {
        return op.type === "create"
          ? [op.opId, op.opId + ":parent", op.opId + ":tags"]
          : [op.opId];
      }),
  );
};
