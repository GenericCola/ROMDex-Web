import { STATES, type indexTree } from "./accepted/core.mjs";
import type { TaskItem } from "./types";
export interface TaskFilters {
  status: string;
  priority: string;
  complexity: string;
  assignee: string;
}
export const emptyFilters = (): TaskFilters => {
  return {
    status: "",
    priority: "",
    complexity: "",
    assignee: "",
  };
};
export const filtersActive = (filters: TaskFilters) => {
  return Object.values(filters).some(Boolean);
};
export const matchesFilters = (
  item: TaskItem,
  tree: ReturnType<typeof indexTree>,
  filters: TaskFilters,
) => {
  return (
    (!filters.status || tree.colors.get(item.id) === filters.status) &&
    (!filters.priority || item.priority === filters.priority) &&
    (!filters.complexity ||
      (item.complexity ?? "") ===
        (filters.complexity === "__unset" ? "" : filters.complexity)) &&
    (!filters.assignee ||
      (filters.assignee === "__unassigned"
        ? !item.assignees?.length
        : item.assignees?.some((person) => {
            return person.id === filters.assignee;
          })))
  );
};
export const statusFilters = Object.entries(STATES);

export const filterFields = (items: TaskItem[]) => {
  const priorities = [
    ...new Set(
      items.map((item) => {
        return item.priority;
      }),
    ),
  ].sort();
  const complexities = [
    ...new Set(
      items.flatMap((item) => {
        return item.complexity ? [item.complexity] : [];
      }),
    ),
  ].sort();
  const people = [
    ...new Map(
      items
        .flatMap((item) => {
          return item.assignees ?? [];
        })
        .map((person) => {
          return [person.id, person];
        }),
    ).values(),
  ].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  const valueOption = (value: string): [string, string] => {
    return [value, value];
  };
  const fields: {
    key: keyof TaskFilters;
    label: string;
    all: string;
    options: [string, string][];
  }[] = [
    {
      key: "status",
      label: "Status",
      all: "All Statuses",
      options: statusFilters,
    },
    {
      key: "priority",
      label: "Priority",
      all: "All Priorities",
      options: priorities.map(valueOption),
    },
    {
      key: "complexity",
      label: "Complexity",
      all: "All Complexities",
      options: [["__unset", "Not Set"], ...complexities.map(valueOption)],
    },
    {
      key: "assignee",
      label: "Assignee",
      all: "All Assignees",
      options: [
        ["__unassigned", "Unassigned"],
        ...people.map((person): [string, string] => {
          return [person.id, person.name];
        }),
      ],
    },
  ];
  return fields;
};
