import { operationTicketIds } from "@/domain/ticket-locks";
import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
export class DeletionReviewRequired extends Error {}
export const deletionReviewTickets = (
  data: WorkspaceData,
  includeReady = false,
) => {
  const ids = new Set<string>();
  for (const op of data.operations) {
    const status = cloudData(data).records[op.opId]?.status;
    if (
      op.type !== "delete" ||
      !status ||
      status === "confirmed" ||
      (!includeReady && status === "ready")
    )
      continue;
    for (const id of operationTicketIds(op)) ids.add(id);
  }
  return ids;
};
export const blockedByDeletion = (op: TaskOperation, data: WorkspaceData) => {
  const held = deletionReviewTickets(data);
  return [...operationTicketIds(op)].some((id) => {
    return held.has(id);
  });
};

export const assertNoBlockedDeletion = (data: WorkspaceData) => {
  if (deletionReviewTickets(data).size)
    throw new DeletionReviewRequired(
      "Review changed deletion targets or uncertain deletion results. Other unrelated changes can continue syncing. " +
        Object.values(cloudData(data).records)
          .filter((record) => {
            return record.status !== "confirmed";
          })
          .map((record) => {
            return record.message;
          })
          .join(" "),
    );
};
