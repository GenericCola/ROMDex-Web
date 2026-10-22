import type { TaskItem } from "./types";
export const validateTask: (value: unknown) => asserts value is TaskItem = (
  value,
) => {
  if (!value || typeof value !== "object") throw Error("Invalid task data.");
  const item = value as TaskItem;
  if (
    ![item.id, item.summary, item.state, item.priority, item.type].every(
      (entry) => {
        return typeof entry === "string" && entry.length > 0;
      },
    ) ||
    typeof item.description !== "string" ||
    !(item.parentId === null || typeof item.parentId === "string") ||
    !(item.complexity === null || typeof item.complexity === "string") ||
    !(item.updated === null || Number.isFinite(item.updated)) ||
    !Number.isSafeInteger(item.commentCount) ||
    item.commentCount < 0 ||
    !Array.isArray(item.comments) ||
    !item.comments.every((comment) => {
      return (
        comment &&
        typeof comment.id === "string" &&
        typeof comment.text === "string" &&
        typeof comment.author === "string" &&
        Number.isFinite(comment.created)
      );
    })
  )
    throw Error("Invalid task data. Existing browser data has been kept.");
};
