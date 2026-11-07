import type { TaskItem, WorkspaceData } from "./types";

// Insert an item among its new siblings (end when `at` is -1), renumber their
// order and make sure the parent is open.
export const placeAmongSiblings = (
  data: WorkspaceData,
  siblings: TaskItem[],
  at: number,
  item: TaskItem,
  parentId: string | null,
) => {
  siblings.splice(at < 0 ? siblings.length : at, 0, item);
  siblings.forEach((entry, index) => {
    data.order[entry.id] = index;
  });
  if (parentId && !data.view.expanded.includes(parentId))
    data.view.expanded.push(parentId);
};
