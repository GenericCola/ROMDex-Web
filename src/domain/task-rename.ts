import { descendants, indexTree, materialize } from "./accepted/core.mjs";
import { placeAmongSiblings } from "./sibling-placement";
import { editTask } from "./task-actions";
import { beginInlineTask } from "./task-inline";
import type { WorkspaceData } from "./types";
import { findWorkspaceItem } from "./workspace-item";
export const beginInlineRename = (data: WorkspaceData, id: string) => {
  if (
    data.newTask?.title.trim() ||
    (data.view.renameId && data.view.renameId !== id)
  )
    throw Error("Finish or cancel the current row first.");
  const item = findWorkspaceItem(data, id);
  if (!item) throw Error("The item no longer exists.");
  data.newTask = null;
  data.view.renameId = id;
  data.titleDrafts[id] ??= item.summary;
};
export const commitInlineRename = (data: WorkspaceData, id: string) => {
  if (data.view.renameId !== id) throw Error("The inline editor changed.");
  const item = findWorkspaceItem(data, id);
  if (!item) throw Error("The item no longer exists.");
  const title = data.titleDrafts[id]?.trim();
  if (!title)
    throw Error(
      "Existing items require a title. Use Delete Item to remove them.",
    );
  if (title !== item.summary) editTask(data, id, { summary: title });
  delete data.titleDrafts[id];
  data.view.renameId = null;
  beginInlineTask(data, item.parentId, id);
};
export const indentInlineRename = (
  data: WorkspaceData,
  id: string,
  outdent: boolean,
) => {
  if (data.view.renameId !== id) throw Error("The inline editor changed.");
  const items = materialize(data.remote, data.operations),
    tree = indexTree(items, data.order),
    item = tree.byId.get(id);
  if (!item) throw Error("The item no longer exists.");
  const title = data.titleDrafts[id]?.trim();
  if (!title) throw Error("Enter a title before changing its level.");
  let parentId: string | null,
    beforeId: string | null = null;
  if (outdent) {
    const parent = item.parentId ? tree.byId.get(item.parentId) : undefined;
    if (!parent) throw Error("This item is already at the top level.");
    ({ parentId } = parent);
    const siblings = tree.children.get(parentId) ?? [],
      at = siblings.findIndex((entry) => {
        return entry.id === parent.id;
      });
    beforeId = siblings[at + 1]?.id ?? null;
  } else {
    const siblings = tree.children.get(item.parentId) ?? [],
      at = siblings.findIndex((entry) => {
        return entry.id === id;
      }),
      previous = siblings[at - 1];
    if (!previous) throw Error("There is no preceding sibling to nest under.");
    parentId = previous.id;
  }
  editTask(data, id, { summary: title, parentId });
  const siblings = (tree.children.get(parentId) ?? []).filter((entry) => {
      return entry.id !== id;
    }),
    at = siblings.findIndex((entry) => {
      return entry.id === beforeId;
    });
  placeAmongSiblings(data, siblings, at, item, parentId);
  if (
    data.view.scope &&
    !descendants(
      materialize(data.remote, data.operations),
      data.view.scope,
    ).includes(id)
  ) {
    data.view.renameId = null;
    delete data.titleDrafts[id];
  }
};
