import { adoptTasks } from "@/cloud/assigned-status";
import { initializeAutomaticSync } from "@/cloud/connection-policy";
import type { TaskItem, WorkspaceData } from "@/domain/types";
export const initializeWorkspaceTasks = (
  data: WorkspaceData,
  tasks: TaskItem[],
  isNew: boolean,
) => {
  initializeAutomaticSync(data, isNew);
  adoptTasks(data, tasks);
};
