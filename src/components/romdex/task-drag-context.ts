import { createContext, use } from "react";
import type { useTaskDrag } from "./use-task-drag";
export const TaskDragContext = createContext<ReturnType<
  typeof useTaskDrag
> | null>(null);
export const useWorkspaceDrag = () => {
  const drag = use(TaskDragContext);
  if (!drag) throw Error("Task dragging requires its workspace provider.");
  return drag;
};
