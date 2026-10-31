import { ticketDependencies } from "@/domain/ticket-lock-dependencies";
import { operationTicketIds, reviewedTicketIds } from "@/domain/ticket-locks";
import type { TaskItem, WorkspaceData } from "@/domain/types";
export const incomingHolds = (data: WorkspaceData, held: Set<string>) => {
  const result = new Set([...held, ...reviewedTicketIds(data)]);
  for (const op of data.operations) {
    // editTask coalesces new fields into the original base. Keep it intact until
    // this ticket's queue clears; other tickets may still refresh immediately.
    for (const id of operationTicketIds(op)) result.add(id);
    if (
      op.type === "delete" ||
      (op.type === "edit" &&
        ("parentId" in op.patch || op.purpose === "rollup"))
    ) {
      const roots = new Set(op.type === "delete" ? op.ids : [op.issueId]);
      for (const id of ticketDependencies(data, data, roots)) result.add(id);
    }
  }
  for (const drafts of [data.titleDrafts, data.commentDrafts])
    for (const [id, draft] of Object.entries(drafts)) if (draft) result.add(id);
  if (data.newTask?.parentId) result.add(data.newTask.parentId);
  if (data.view.renameId) result.add(data.view.renameId);
  return result;
};
export const incomingHierarchyHeld = (
  data: WorkspaceData,
  all: TaskItem[],
  item: TaskItem,
  held: Set<string>,
) => {
  const before = data.remote.find((entry) => {
    return entry.id === item.id;
  });
  if (before?.parentId === item.parentId) return false;
  if (
    (before?.parentId && held.has(before.parentId)) ||
    (item.parentId && held.has(item.parentId))
  )
    return true;
  const affected = ticketDependencies(
    data,
    { ...data, remote: all },
    new Set([item.id]),
  );
  return [...affected].some((id) => {
    return held.has(id);
  });
};
