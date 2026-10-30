import type { TaskItem } from "./types";
export const taskAssigneeLabel = (item: TaskItem) => {
  const ids =
    item.assignee === undefined
      ? (item.assignees ?? []).map((person) => {
          return person.id;
        })
      : Array.isArray(item.assignee)
        ? item.assignee
        : item.assignee
          ? [item.assignee]
          : [];
  return (
    ids
      .map((id) => {
        return (
          item.assignees?.find((person) => {
            return person.id === id;
          })?.name ?? "Unlisted Assignee"
        );
      })
      .join(", ") || "Unassigned"
  );
};
