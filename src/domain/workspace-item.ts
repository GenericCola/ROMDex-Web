import { materialize } from "./accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "./types";

export const findWorkspaceItem = (
  data: WorkspaceData,
  id: string,
): TaskItem | undefined => {
  return materialize(data.remote, data.operations).find((item) => {
    return item.id === id;
  });
};
