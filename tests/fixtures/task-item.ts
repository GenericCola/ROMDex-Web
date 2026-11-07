import type { TaskItem } from "../../src/domain/types.ts";

/** A plain "To do" task; `overrides` replace any field. */
export const taskItem = (
  id: string,
  parentId: string | null = null,
  overrides: Partial<TaskItem> = {},
): TaskItem => {
  return {
    id,
    parentId,
    summary: id,
    description: "",
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
    ...overrides,
  };
};
