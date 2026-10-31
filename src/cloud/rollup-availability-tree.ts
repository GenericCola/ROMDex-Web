import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { incomingHolds } from "./incoming-holds";
import { pendingAssignedStatusIds } from "./incoming-retirement";
export const availabilityTree = (
  data: WorkspaceData,
  previous: Map<string, TaskItem>,
  fresh: Map<string, TaskItem>,
) => {
  const unavailable = [...previous.values()].filter((item) => {
    return !fresh.has(item.id);
  });
  const held = incomingHolds(data, new Set());
  const pendingIds = new Set<string>();
  const assignedIntent = pendingAssignedStatusIds(data);
  for (const item of unavailable) {
    if (held.has(item.id) || held.has("*") || assignedIntent.has(item.id)) {
      held.add(item.id);
      pendingIds.add(item.id);
    }
  }
  // Keep local work recoverable, but never feed missing cached children into
  // the fresh server tree used to calculate current parent statuses.
  const combined = new Map(fresh);
  for (const item of unavailable)
    if (held.has(item.id)) combined.set(item.id, item);
  const items = [...combined.values()];
  indexTree(items);
  return {
    items,
    fresh,
    unavailable,
    missingIds: unavailable.map((item) => {
      return item.id;
    }),
    deniedIds: [] as string[],
    blocked: new Set<string>(),
    pendingIds,
  };
};
