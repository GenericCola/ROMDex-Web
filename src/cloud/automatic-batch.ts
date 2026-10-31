import { draftTicketIds, hasUnscopedDraftEdits } from "@/domain/editor-drafts";
import { automaticEditingTicketIds } from "@/domain/task-editing";
import { operationTicketIds } from "@/domain/ticket-locks";
import type { WorkspaceData } from "@/domain/types";
import { deletionReviewTickets } from "./deletion-isolation";
import { blockedByReview, reviewTickets } from "./review-isolation";
import { unblockedStatusWork } from "./review-status-work";
import { cloudData } from "./types";
// An edited ticket stays local; independent scalar/file/comment changes can proceed.
export const automaticBatch = (
  data: WorkspaceData,
): Set<string> | undefined => {
  const drafts = draftTicketIds();
  if (hasUnscopedDraftEdits()) return new Set<string>();
  const editing = new Set([...automaticEditingTicketIds(), ...drafts]);
  const reviewing = reviewTickets(data);
  const readyConsent = data.operations.some((op) => {
    return cloudData(data).records[op.opId]?.status === "ready";
  });
  if (!editing.size && reviewing.size && !readyConsent) {
    return (cloudData(data).rollupPending && unblockedStatusWork(data)) ||
      data.operations.some((op) => {
        return !blockedByReview(op, data);
      })
      ? undefined
      : new Set<string>();
  }
  const held = new Set([
    ...editing,
    ...deletionReviewTickets(data, true),
    ...reviewTickets(data, true),
  ]);
  if (!held.size) return undefined;
  return new Set(
    data.operations
      .filter((op) => {
        if (
          op.type === "create" ||
          op.type === "delete" ||
          op.issueId.startsWith("local-")
        )
          return false;
        if (
          op.type === "edit" &&
          (op.purpose === "rollup" || "parentId" in op.patch)
        )
          return false;
        return ![...operationTicketIds(op)].some((id) => {
          return held.has(id);
        });
      })
      .map((op) => {
        return op.opId;
      }),
  );
};
