import { indexTree, STATES, youTrackState } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { observeStatus } from "./assigned-status";
import { reviewStatusBlocks, reviewTickets } from "./review-isolation";
import { readRollupAvailability } from "./rollup-availability";
import { readableRollupSubtree } from "./rollup-subtree";
import { cloudData, type DeliveryPort } from "./types";
export const readRollupTree = async (
  data: WorkspaceData,
  port: DeliveryPort,
) => {
  const available = await readRollupAvailability(data, port);
  const reviewed = reviewTickets(data);
  const items = available.items.map((item) => {
    validateTask(item);
    if (!available.fresh.has(item.id) || available.blocked.has(item.id))
      return item;
    // Read the current status for calculation without changing a held ticket's
    // pending assignment/receipt bookkeeping.
    const target = reviewed.has(item.id)
      ? {
          ...data,
          cloud: {
            ...cloudData(data),
            assigned: { ...cloudData(data).assigned },
          },
        }
      : data;
    return observeStatus(target, item);
  });
  const calculation = items.filter((item) => {
    return available.fresh.has(item.id);
  });
  const tree = indexTree(calculation);
  const reviewBlocked = reviewStatusBlocks(data, calculation);
  const deepest = [...calculation].sort((a, b) => {
    return (tree.depths.get(b.id) ?? 0) - (tree.depths.get(a.id) ?? 0);
  });
  const desired = (item: TaskItem) => {
    const color = tree.colors.get(item.id);
    if (!color) throw Error("A task has no calculated status.");
    return youTrackState(
      tree.children.get(item.id)?.length
        ? STATES[color]
        : (item.assignedState ?? item.state),
    );
  };
  let next: TaskItem | undefined;
  const deferred: TaskItem[] = [];
  const linkedMissingIds: string[] = [];
  for (const item of deepest) {
    if (
      !available.fresh.has(item.id) ||
      available.blocked.has(item.id) ||
      item.state === desired(item)
    )
      continue;
    if (reviewBlocked.has(item.id)) {
      deferred.push(item);
      continue;
    }
    if (
      await readableRollupSubtree(
        item,
        calculation,
        port,
        available.blocked,
        linkedMissingIds,
      )
    ) {
      next = item;
      break;
    }
  }
  return {
    items,
    desired,
    next,
    deferred,
    unavailable: available.unavailable,
    missingIds: [...new Set([...available.missingIds, ...linkedMissingIds])],
    linkedMissingIds,
    deniedIds: available.deniedIds,
    blockedIds: [
      ...new Set([...available.blocked, ...available.pendingIds]),
    ].filter((id) => {
      return available.fresh.has(id) || available.pendingIds.has(id);
    }),
  };
};
