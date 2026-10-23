import { descendants, indexTree } from "./accepted/core.mjs";
import {
  filtersActive,
  matchesFilters,
  type TaskFilters,
} from "./task-filters";
import type { TaskItem, WorkspaceData } from "./types";
export const workRows = (
  items: TaskItem[],
  data: WorkspaceData,
  filters: TaskFilters,
) => {
  const tree = indexTree(items, data.order),
    { scope } = data.view,
    filtering = filtersActive(filters);
  const allowed = scope ? new Set(descendants(items, scope)) : null;
  const query = data.view.search.trim().toLowerCase();
  const rows: TaskItem[] = [];
  const collect = (parentId: string | null) => {
    for (const item of tree.children.get(parentId) ?? []) {
      const visible =
        (!allowed || allowed.has(item.id)) &&
        (!data.view.hideCompleted ||
          filters.status ||
          tree.colors.get(item.id) !== "green") &&
        matchesFilters(item, tree, filters) &&
        (!query ||
          (item.summary + " " + item.id + " " + item.description)
            .toLowerCase()
            .includes(query));
      if (visible) rows.push(item);
      if (
        filtering ||
        query ||
        data.view.expanded.includes(item.id) ||
        item.id === scope ||
        (allowed && !allowed.has(item.id))
      )
        collect(item.id);
    }
  };
  collect(null);
  return rows;
};
