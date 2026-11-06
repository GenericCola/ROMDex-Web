import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem } from "@/domain/types";

const compareIds = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, { numeric: true });
};

/** Web order positions to desktop ordered child lists (parent id or "ROOT"). */
export const captureOrders = (
  items: TaskItem[],
  order: Record<string, number>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  const rank = (id: string): number => {
    return order[id] ?? Number.MAX_SAFE_INTEGER;
  };
  for (const [parent, siblings] of indexTree(items).children) {
    if (
      !siblings.some((item) => {
        return Object.hasOwn(order, item.id);
      })
    )
      continue;
    result[parent ?? "ROOT"] = [...siblings]
      .sort((a, b) => {
        return rank(a.id) - rank(b.id) || compareIds(a.id, b.id);
      })
      .map((item) => {
        return item.id;
      });
  }
  return result;
};

/** Desktop ordered child lists back to web positions. */
export const projectOrders = (
  orders: Record<string, string[]>,
  items: TaskItem[],
  current: Record<string, number>,
  previous: Record<string, string[]>,
): Record<string, number> => {
  const tree = indexTree(items, current);
  const next = { ...current };
  const childrenOf = (parent: string): TaskItem[] => {
    return tree.children.get(parent === "ROOT" ? null : parent) ?? [];
  };
  for (const parent of Object.keys(previous))
    if (!Object.hasOwn(orders, parent))
      for (const item of childrenOf(parent)) delete next[item.id];
  for (const [parent, ids] of Object.entries(orders)) {
    const siblings = childrenOf(parent);
    const available = new Set(
      siblings.map((item) => {
        return item.id;
      }),
    );
    const ordered = ids.filter((id) => {
      return available.has(id);
    });
    for (const item of siblings)
      if (!ordered.includes(item.id)) ordered.push(item.id);
    if (
      ordered.every((id, index) => {
        return id === siblings[index]?.id;
      })
    )
      continue;
    ordered.forEach((id, index) => {
      next[id] = index;
    });
  }
  return next;
};
