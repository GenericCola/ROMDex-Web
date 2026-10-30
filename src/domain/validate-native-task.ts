import type { TaskItem } from "./types";
const ids = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      return typeof entry === "string" && !!entry;
    }) &&
    new Set(value).size === value.length
  );
};
export const validateNativeTask = (item: TaskItem) => {
  if (
    item.assignee !== undefined &&
    item.assignee !== null &&
    !(typeof item.assignee === "string" && item.assignee) &&
    !ids(item.assignee)
  )
    throw Error("Invalid native assignee data. Keep recovery.");
  if (item.tags !== undefined && !ids(item.tags))
    throw Error("Invalid native tag data. Keep recovery.");
  if (item.dueDate !== undefined && item.dueDate !== null) {
    if (
      typeof item.dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
    )
      throw Error("Invalid native due date. Keep recovery.");
    const date = new Date(item.dueDate + "T12:00:00.000Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== item.dueDate
    )
      throw Error("Invalid native due date. Keep recovery.");
  }
  if (
    item.tagNames !== undefined &&
    (!Array.isArray(item.tagNames) ||
      item.tagNames.some((tag) => {
        return (
          !tag ||
          typeof tag.id !== "string" ||
          !tag.id ||
          typeof tag.name !== "string"
        );
      }))
  )
    throw Error("Invalid native tag labels. Keep recovery.");
  if (
    item._custom !== undefined &&
    (!Array.isArray(item._custom) ||
      item._custom.some((field) => {
        return (
          !field ||
          typeof field !== "object" ||
          Array.isArray(field) ||
          typeof field.name !== "string" ||
          (field.id !== undefined && typeof field.id !== "string") ||
          (field.$type !== undefined && typeof field.$type !== "string")
        );
      }))
  )
    throw Error("Invalid native field metadata. Keep recovery.");
};
