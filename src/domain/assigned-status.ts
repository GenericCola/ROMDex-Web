import { STATES } from "./accepted/core.mjs";
import { editTask } from "./task-actions";
import type { LampColor, WorkspaceData } from "./types";
import { findWorkspaceItem } from "./workspace-item";

export const assignTaskStatus = (
  data: WorkspaceData,
  id: string,
  color: LampColor,
  base: string,
) => {
  const item = findWorkspaceItem(data, id);
  if (!item) throw Error("The item no longer exists.");
  if ((item.assignedState ?? item.state) !== base)
    throw Error("Assigned status changed. Close and reopen the status menu.");
  editTask(data, id, { assignedState: STATES[color] });
};
