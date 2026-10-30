import { indexTree, materialize } from "./accepted/core.mjs";
import { selectorExpansion } from "./task-presentation";
import type { WorkspaceData } from "./types";
export const revealDropParent = (
  data: WorkspaceData,
  parentId: string | null,
) => {
  if (!parentId) return;
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  const parent = tree.byId.get(parentId);
  if (!parent) throw Error("The destination no longer exists.");
  data.view.selectorExpanded = selectorExpansion(tree, parent, false);
};
