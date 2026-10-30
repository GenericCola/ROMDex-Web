import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { assignmentPatch, assignStatus } from "./assigned-status";
import { equal } from "./delivery-helpers";
import { confirmStatusAttempt } from "./shared-status-delivery";
import { tagIds } from "./tag-types";
import { cloudData } from "./types";
type Edit = Extract<TaskOperation, { type: "edit" }>;
export const confirmEdit = (operation: Edit, remote: TaskItem) => {
  const patch =
    operation.purpose === "rollup"
      ? operation.patch
      : assignmentPatch(operation.patch);
  const matches = Object.entries(patch).every(([key, value]) => {
    if (key === "tags") return equal(tagIds(remote.tags), tagIds(value));
    if (
      remote.sharedStatus ||
      key !== "assignedState" ||
      operation.purpose === "rollup"
    )
      return equal(remote[key as keyof TaskItem], value);
    return (
      equal(
        remote.assignedState,
        operation.base.assignedState ?? operation.base.state,
      ) || equal(remote.assignedState, value)
    );
  });
  if (!matches)
    throw Error(
      "YouTrack does not match the queued change. No retry was sent.",
    );
};
export const reviewedEdit = (
  data: WorkspaceData,
  operation: Edit,
  remote: TaskItem,
  confirm: boolean,
) => {
  if (confirm)
    confirmStatusAttempt(
      remote,
      cloudData(data).records[operation.opId]?.metadataWrite,
    );
  if (cloudData(data).sharedStatuses) return remote;
  if (operation.purpose === "rollup") {
    const record = cloudData(data).assigned?.[operation.issueId];
    if (record) record.pendingState = null;
    return remote;
  }
  const value = assignmentPatch(operation.patch).assignedState;
  return confirm && value !== undefined
    ? assignStatus(data, remote, value)
    : remote;
};
