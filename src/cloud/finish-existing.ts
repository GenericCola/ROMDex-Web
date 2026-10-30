import type { TaskItem, TaskOperation } from "@/domain/types";
import { assignStatus, observeStatus } from "./assigned-status";
import { acknowledge } from "./journal";
import type { Commit } from "./types";
export const finishExisting = async (
  operation: Extract<TaskOperation, { type: "edit" | "comment" }>,
  remote: TaskItem,
  assignedState: string | undefined,
  verified: TaskItem,
  commit: Commit,
) => {
  await commit((data) => {
    const observed = observeStatus(data, verified);
    if (
      assignedState !== undefined &&
      observed.assignedState !== remote.assignedState &&
      observed.assignedState !== assignedState
    )
      throw Error("Assigned status changed during delivery.");
    acknowledge(
      data,
      operation,
      assignedState === undefined
        ? observed
        : assignStatus(data, verified, assignedState),
    );
  });
};
