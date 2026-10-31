import { indexTree, STATES, youTrackState } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { observeStatus } from "./assigned-status";
import { readRollupAvailability } from "./rollup-availability";
import { readableRollupSubtree } from "./rollup-subtree";
import type { DeliveryPort } from "./types";
export const readRollupTree = async (
  data: WorkspaceData,
  port: DeliveryPort,
) => {
  const available = await readRollupAvailability(data, port);
  const items = available.items.map((item) => {
    validateTask(item);
    return available.fresh.has(item.id) && !available.blocked.has(item.id)
      ? observeStatus(data, item)
      : item;
  });
  const calculation = items.filter((item) => {
    return available.fresh.has(item.id);
  });
  const tree = indexTree(calculation);
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
  const linkedMissingIds: string[] = [];
  for (const item of deepest) {
    if (
      !available.fresh.has(item.id) ||
      available.blocked.has(item.id) ||
      item.state === desired(item)
    )
      continue;
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
