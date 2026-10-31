import { ticketDependencies } from "@/domain/ticket-lock-dependencies";
import { operationTicketIds } from "@/domain/ticket-locks";
import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { cloudData, type DeliveryRecord } from "./types";
export class OperationReviewRequired extends Error {}
const affected = (operation: TaskOperation, data: WorkspaceData) => {
  const ids = operationTicketIds(operation);
  if (
    operation.type === "delete" ||
    operation.type === "create" ||
    (operation.type === "edit" &&
      ("parentId" in operation.patch || operation.purpose === "rollup"))
  ) {
    const roots = new Set(
      operation.type === "delete" ? operation.ids : [operation.issueId],
    );
    for (const id of ticketDependencies(data, data, roots)) ids.add(id);
  }
  return ids;
};
export const reviewTickets = (data: WorkspaceData, includeReady = false) => {
  const ids = new Set<string>();
  for (const operation of data.operations) {
    const status = cloudData(data).records[operation.opId]?.status;
    if (
      !status ||
      ![
        "conflict",
        "attempting",
        "uncertain",
        ...(includeReady ? ["ready"] : []),
      ].includes(status)
    )
      continue;
    for (const id of affected(operation, data)) ids.add(id);
  }
  return ids;
};
export const blockedByReview = (
  operation: TaskOperation,
  data: WorkspaceData,
) => {
  const held = reviewTickets(data);
  return [...affected(operation, data)].some((id) => {
    return held.has(id);
  });
};
export const assertNoBlockedReview = (data: WorkspaceData) => {
  const ids = [...reviewTickets(data)];
  if (ids.length) {
    const records = data.operations
      .map((op) => {
        return cloudData(data).records[op.opId];
      })
      .filter((record): record is DeliveryRecord => {
        return (
          !!record &&
          ["conflict", "attempting", "uncertain"].includes(record.status)
        );
      });
    const reason = records.some((record) => {
      return record.status !== "conflict";
    })
      ? "An earlier request has an uncertain result. "
      : records.some((record) => {
            return record.conflicts?.length;
          })
        ? "Review conflicting edits. "
        : "";
    throw new OperationReviewRequired(
      reason +
        "Review needed for " +
        ids.slice(0, 5).join(", ") +
        (ids.length > 5 ? " and other affected tasks" : "") +
        ". " +
        [
          ...new Set(
            records.map((record) => {
              return record.message;
            }),
          ),
        ]
          .slice(0, 2)
          .join(" ") +
        " Other unrelated changes can sync.",
    );
  }
};
export const reviewStatusBlocks = (data: WorkspaceData, items: TaskItem[]) => {
  const blocked = reviewTickets(data);
  const parents = new Map(
    items.map((item) => {
      return [item.id, item.parentId];
    }),
  );
  for (const id of [...blocked]) {
    let parent = parents.get(id);
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      blocked.add(parent);
      parent = parents.get(parent);
    }
  }
  return blocked;
};
