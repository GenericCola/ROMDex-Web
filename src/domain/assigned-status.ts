import { materialize, STATES } from "./accepted/core.mjs";
import { editTask } from "./task-actions";
import type { LampColor, WorkspaceData } from "./types";

export const assignTaskStatus = (
  data: WorkspaceData,
  id: string,
  color: LampColor,
  base: string,
) => {
  const item = materialize(data.remote, data.operations).find((candidate) => {
    return candidate.id === id;
  });
  if (!item) throw Error("The item no longer exists.");
  if ((item.assignedState ?? item.state) !== base)
    throw Error("Assigned status changed. Close and reopen the status menu.");
  editTask(data, id, { assignedState: STATES[color] });
};
