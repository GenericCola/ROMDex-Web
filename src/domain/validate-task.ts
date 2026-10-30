import { parseSharedStatus } from "@/cloud/shared-status-protocol";
import type { TaskItem } from "./types";
import { validateNativeTask } from "./validate-native-task";
export const validateTask: (value: unknown) => asserts value is TaskItem = (
  value,
) => {
  if (!value || typeof value !== "object") throw Error("Invalid task data.");
  const item = value as TaskItem;
  validateNativeTask(item);
  if (
    item.assignees !== undefined &&
    (!Array.isArray(item.assignees) ||
      !item.assignees.every((person) => {
        return (
          person &&
          typeof person.id === "string" &&
          !!person.id &&
          typeof person.name === "string"
        );
      }))
  )
    throw Error("Invalid assignee data. Existing browser data has been kept.");
  if (
    item.url !== undefined &&
    (typeof item.url !== "string" ||
      !/^PMON-[1-9]\d*$/.test(item.id) ||
      item.url !== "https://thegobindsingh.youtrack.cloud/issue/" + item.id)
  )
    throw Error("Task links must point to their verified YouTrack issue.");
  if (item.sharedStatus !== undefined)
    parseSharedStatus(item.sharedStatus, item.id);
  if (
    ![item.id, item.summary, item.state, item.priority, item.type].every(
      (entry) => {
        return typeof entry === "string" && entry.length > 0;
      },
    ) ||
    (item.assignedState !== undefined &&
      (typeof item.assignedState !== "string" || !item.assignedState)) ||
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
