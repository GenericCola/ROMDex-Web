import { indexTree } from "./accepted/core.mjs";
import type { TaskItem } from "./types";

// Preserve the accepted desktop renderer's labels without rewriting task data.
export const itemName = (item: Pick<TaskItem, "summary"> | undefined) => {
  const label = item?.summary?.replace(/^\[Epic\]\s*/, "");
  if (label === "") return "Untitled";
  return label ?? "Untitled";
};
export const taskTier = (depth: number) => {
  return ["Epic", "Saga", "Story", "Verse"][depth] ?? "Task";
};
export const selectorSubtitle = (depth: number, count: number) => {
  const child = taskTier(depth + 1);
  const plural =
    count === 1 ? child : child === "Story" ? "Stories" : child + "s";
  return `${taskTier(depth)} · ${count} ${plural}`;
};

export const selectorExpansion = (
  tree: ReturnType<typeof indexTree>,
  item: TaskItem,
  collapse: boolean,
) => {
  const path: string[] = [];
  let ancestor: TaskItem | undefined = collapse
    ? tree.byId.get(item.parentId ?? "")
    : item;
  while (ancestor) {
    if (
      (tree.depths.get(ancestor.id) ?? 0) < 3 &&
      (tree.children.get(ancestor.id)?.length ?? 0) > 0
    )
      path.unshift(ancestor.id);
    ancestor = tree.byId.get(ancestor.parentId ?? "");
  }
  return path;
};
