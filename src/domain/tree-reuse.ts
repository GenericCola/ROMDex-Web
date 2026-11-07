import { indexTree } from "./accepted/core.mjs";
import type { TaskItem } from "./types";
export type Tree = ReturnType<typeof indexTree>;
export interface TreeMemo {
  items: TaskItem[];
  order: Record<string, number>;
  tree: Tree;
}
const sameOrder = (
  a: Record<string, number>,
  b: Record<string, number>,
): boolean => {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    return Object.hasOwn(b, key) && a[key] === b[key];
  });
};
const sameShape = (a: TaskItem[], b: TaskItem[]): boolean => {
  return a.every((item, index) => {
    const other = b[index];
    return (
      item === other ||
      (item.id === other?.id &&
        item.parentId === other.parentId &&
        item.assignedState === other.assignedState &&
        item.state === other.state)
    );
  });
};
// indexTree() equivalent that skips sorting and rollups when only fields
// outside id, parentId, state, assignedState and order changed.
export const reuseTree = (
  memo: TreeMemo | undefined,
  items: TaskItem[],
  order: Record<string, number>,
): Tree => {
  if (
    memo?.items.length !== items.length ||
    !sameOrder(memo.order, order) ||
    !sameShape(memo.items, items)
  )
    return indexTree(items, order);
  const byId = new Map(
    items.map((item) => {
      return [item.id, item] as const;
    }),
  );
  if (byId.size !== items.length) return indexTree(items, order);
  const children = new Map<string | null, TaskItem[]>();
  for (const [key, list] of memo.tree.children) {
    const next: TaskItem[] = [];
    for (const child of list) {
      const item = byId.get(child.id);
      if (!item) return indexTree(items, order);
      next.push(item);
    }
    children.set(key, next);
  }
  return {
    byId,
    children,
    depths: memo.tree.depths,
    colors: memo.tree.colors,
  };
};
