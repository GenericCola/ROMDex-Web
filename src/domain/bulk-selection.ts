import { indexTree, validateMove } from "./accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "./types";
// Adapted from desktop bulk-hierarchy.mjs at 28c0ce4; no remote atomicity claim.
export const siblingSelection = (
  items: TaskItem[],
  order: WorkspaceData["order"],
  ids: string[],
) => {
  const tree = indexTree(items, order),
    unique = [...new Set(ids)];
  if (unique.length < 2) throw Error("Select at Least Two Items.");
  if (unique.length > 1000)
    throw Error("Select No More Than 1,000 Items at a Time.");
  const selected = unique.map((id) => {
    const item = tree.byId.get(id);
    if (!item) throw Error("A Selected Item No Longer Exists.");
    return item;
  });
  const parentId = selected[0]?.parentId ?? null;
  if (
    selected.some((item) => {
      return item.parentId !== parentId;
    })
  )
    throw Error(
      "Select Items with the Same Parent to Group or Move Them Together.",
    );
  if (parentId && !tree.byId.has(parentId))
    throw Error("The Current Parent No Longer Exists.");
  const keys = new Set(unique),
    members = (tree.children.get(parentId) ?? []).filter((item) => {
      return keys.has(item.id);
    });
  return { tree, parentId, members };
};
export const bulkMovePlan = (
  items: TaskItem[],
  order: WorkspaceData["order"],
  ids: string[],
  parentId: string | null,
  beforeId: string | null = null,
) => {
  const selection = siblingSelection(items, order, ids),
    keys = new Set(ids);
  for (const item of selection.members) validateMove(items, item.id, parentId);
  const siblings = selection.tree.children.get(parentId) ?? [];
  if (
    beforeId &&
    !siblings.some((item) => {
      return item.id === beforeId;
    })
  )
    throw Error("The Insertion Target No Longer Exists.");
  const boundary = beforeId
    ? siblings.findIndex((item) => {
        return item.id === beforeId;
      })
    : siblings.length;
  const next =
    siblings.slice(boundary).find((item) => {
      return !keys.has(item.id);
    })?.id ?? null;
  const destination = siblings.filter((item) => {
    return !keys.has(item.id);
  });
  const at = next
    ? destination.findIndex((item) => {
        return item.id === next;
      })
    : destination.length;
  destination.splice(at, 0, ...selection.members);
  return {
    ...selection,
    destinationParentId: parentId,
    beforeId: next,
    destination,
  };
};
