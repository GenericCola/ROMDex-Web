import { indexTree, materialize } from "./accepted/core.mjs";
import type { WorkspaceData } from "./types";
export const moveSibling = (
  data: WorkspaceData,
  id: string,
  direction: -1 | 1,
) => {
  const items = materialize(data.remote, data.operations),
    tree = indexTree(items, data.order),
    item = tree.byId.get(id);
  if (!item) throw Error("The task no longer exists.");
  const siblings = [...(tree.children.get(item.parentId) ?? [])],
    at = siblings.findIndex((candidate) => {
      return candidate.id === id;
    }),
    to = at + direction;
  if (to < 0 || to >= siblings.length) return;
  const other = siblings[to];
  if (!other) return;
  siblings[to] = item;
  siblings[at] = other;
  siblings.forEach((sibling, index) => {
    data.order[sibling.id] = index;
  });
};
