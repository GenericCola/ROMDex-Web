import { descendants, indexTree, materialize } from "./accepted/core.mjs";
import { createTask } from "./task-actions";
import type { WorkspaceData } from "./types";
export const beginInlineTask = (
  data: WorkspaceData,
  parentId: string | null,
  afterId?: string | null,
) => {
  if (data.newTask?.title.trim() || data.view.renameId)
    throw Error("Finish or cancel the current row first.");
  const items = materialize(data.remote, data.operations),
    tree = indexTree(items, data.order);
  if (parentId && !tree.byId.has(parentId))
    throw Error("The parent no longer exists.");
  if (
    data.view.scope &&
    parentId !== data.view.scope &&
    !descendants(items, data.view.scope).includes(parentId ?? "")
  )
    data.view.scope = parentId;
  let ancestor = parentId;
  while (ancestor) {
    if (!data.view.expanded.includes(ancestor))
      data.view.expanded.push(ancestor);
    ancestor = tree.byId.get(ancestor)?.parentId ?? null;
  }
  data.newTask = {
    title: "",
    parentId,
    afterId:
      afterId ?? (tree.children.get(parentId) ?? []).at(-1)?.id ?? parentId,
  };
};
export const commitInlineTask = (data: WorkspaceData) => {
  const draft = data.newTask;
  if (!draft) return;
  if (!draft.title.trim()) {
    data.newTask = null;
    return;
  }
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  const siblings = (tree.children.get(draft.parentId) ?? []).map((item) => {
    return item.id;
  });
  const id = createTask(data, draft.parentId, draft.title);
  const at = siblings.indexOf(draft.afterId ?? "");
  siblings.splice(at < 0 ? siblings.length : at + 1, 0, id);
  siblings.forEach((entry, index) => {
    data.order[entry] = index;
  });
  data.newTask = { title: "", parentId: draft.parentId, afterId: id };
};
export const indentInlineTask = (data: WorkspaceData, outdent: boolean) => {
  const draft = data.newTask;
  if (!draft) return;
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  if (outdent) {
    const parent = draft.parentId ? tree.byId.get(draft.parentId) : undefined;
    if (!parent) return;
    draft.parentId = parent.parentId;
    draft.afterId = parent.id;
  } else {
    const previous = draft.afterId ? tree.byId.get(draft.afterId) : undefined;
    if (previous?.parentId !== draft.parentId)
      throw Error("There is no preceding sibling to nest under.");
    draft.parentId = previous.id;
    draft.afterId =
      (tree.children.get(previous.id) ?? []).at(-1)?.id ?? previous.id;
    if (!data.view.expanded.includes(previous.id))
      data.view.expanded.push(previous.id);
  }
};
