import { indexTree, materialize } from "./accepted/core.mjs";
import type { TaskItem, TaskOperation, WorkspaceData } from "./types";
type Tree = ReturnType<typeof indexTree>;
const itemCache = new WeakMap<
  TaskOperation[],
  { remote: TaskItem[]; items: TaskItem[] }
>();
const treeCache = new WeakMap<
  TaskItem[],
  { order: Record<string, number>; tree: Tree }
>();
let previous: TaskItem[] = [];
export const workspaceItems = (
  data: Pick<WorkspaceData, "remote" | "operations">,
): TaskItem[] => {
  const hit = itemCache.get(data.operations);
  if (hit?.remote === data.remote) return hit.items;
  const fresh = materialize(data.remote, data.operations);
  const before = new Map(
    previous.map((item) => {
      return [item.id, item] as const;
    }),
  );
  let reused = 0;
  const merged = fresh.map((item) => {
    const old = before.get(item.id);
    if (old && JSON.stringify(old) === JSON.stringify(item)) {
      reused += 1;
      return old;
    }
    return item;
  });
  const same =
    reused === fresh.length &&
    fresh.length === previous.length &&
    merged.every((item, index) => {
      return item === previous[index];
    });
  const items = same ? previous : merged;
  previous = items;
  itemCache.set(data.operations, { remote: data.remote, items });
  return items;
};
export const workspaceTree = (
  items: TaskItem[],
  order: Record<string, number>,
): Tree => {
  const hit = treeCache.get(items);
  if (hit?.order === order) return hit.tree;
  const tree = indexTree(items, order);
  treeCache.set(items, { order, tree });
  return tree;
};
export const subtreeIds = (tree: Tree, id: string): string[] => {
  const out: string[] = [];
  const walk = (key: string) => {
    for (const child of tree.children.get(key) ?? []) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
};
