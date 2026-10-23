import type { JsonValue } from "@/domain/json";
import { jsonObject } from "@/domain/json";
import type { TaskItem } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
export const desktopText = (
  value: JsonValue | undefined,
  fallback = "",
): string => {
  return typeof value === "string" ? value : fallback;
};
export const desktopTask = (value: JsonValue): TaskItem => {
  const raw = jsonObject(value),
    id = desktopText(raw.id);
  if (!/^PMON-[1-9]\d*$/.test(id))
    throw Error("The desktop baseline contains a task outside PMON.");
  const result: TaskItem = {
    assignees:
      typeof raw.assignee === "string" && raw.assignee
        ? [
            {
              id: raw.assignee,
              name: desktopText(raw.assigneeName, raw.assignee),
            },
          ]
        : [],
    id,
    summary: desktopText(raw.summary),
    description: desktopText(raw.description),
    parentId: raw.parentId === null ? null : desktopText(raw.parentId) || null,
    state: desktopText(raw.state, "To do"),
    priority: desktopText(raw.priority, "Normal"),
    complexity:
      raw.complexity === null ? null : desktopText(raw.complexity) || null,
    type: desktopText(raw.type, "Task"),
    updated: typeof raw.updated === "number" ? raw.updated : null,
    comments: [],
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
    url: "https://thegobindsingh.youtrack.cloud/issue/" + id,
  };
  if (Array.isArray(raw.comments))
    result.comments = raw.comments.map((entry) => {
      const c = jsonObject(entry);
      return {
        id: desktopText(c.id),
        text: desktopText(c.text),
        author: desktopText(c.author, "Unknown"),
        created: typeof c.created === "number" ? c.created : 0,
      };
    });
  validateTask(result);
  return result;
};
