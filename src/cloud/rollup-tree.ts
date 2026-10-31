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
  const ids = new Set(
    available.items.map((item) => {
      return item.id;
    }),
  );
  const items = available.items.map((item) => {
    validateTask(item);
    if (item.parentId && !ids.has(item.parentId))
      throw Error("A task has an unreadable parent.");
    return available.fresh.has(item.id) && !available.blocked.has(item.id)
      ? observeStatus(data, item)
      : item;
  });
  const tree = indexTree(items);
  const deepest = [...items].sort((a, b) => {
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
        items,
        port,
        available.blocked,
        available.missingIds,
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
    missingIds: available.missingIds,
    deniedIds: available.deniedIds,
    blockedIds: [...available.blocked].filter((id) => {
      return available.fresh.has(id) || available.pendingIds.has(id);
    }),
  };
};
