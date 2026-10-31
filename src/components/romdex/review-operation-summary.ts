import type { DeliveryRecord } from "@/cloud/types";
import type { TaskItem, TaskOperation } from "@/domain/types";
import {
  reviewConcise as concise,
  reviewFieldValue as display,
  reviewFieldLabel,
} from "./review-field-format";
export const reviewTaskSnapshots = (
  operation: TaskOperation,
  record?: DeliveryRecord,
) => {
  return [
    operation.type === "edit"
      ? operation.base
      : operation.type === "create"
        ? operation.item
        : undefined,
    record?.remote,
  ].filter((task): task is TaskItem => {
    return !!task;
  });
};
export const proposedOperationSummary = (
  operation: TaskOperation,
  record?: DeliveryRecord,
): string[] => {
  const tasks = reviewTaskSnapshots(operation, record);
  switch (operation.type) {
    case "edit":
      return Object.entries(operation.patch).map(([field, value]) => {
        return `change ${field === "assignedState" ? "status" : (reviewFieldLabel(field, tasks) ?? "field").toLowerCase()} to ${display(field, value, tasks)}`;
      });
    case "create":
      return [`create task: ${concise(operation.item.summary)}`];
    case "comment":
      return ["add a comment (text hidden)"];
    case "attachment":
      return [`upload ${concise(operation.file.name)}`];
    case "attachment-delete":
      return [`delete attachment ${concise(operation.base.name)}`];
    case "delete":
      return [`delete listed tasks: ${operation.ids.join(", ")}`];
  }
};
export const reviewChoiceLabel = (
  operation: TaskOperation | undefined,
  record: DeliveryRecord,
  local: boolean,
) => {
  if (
    operation?.type !== "edit" ||
    Object.keys(operation.patch).length !== 1 ||
    record.conflicts?.length !== 1
  )
    return undefined;
  const conflict = record.conflicts[0];
  if (!conflict || !Object.hasOwn(operation.patch, conflict.field))
    return undefined;
  const tasks = reviewTaskSnapshots(operation, record);
  const value = display(
    conflict.field,
    local ? conflict.local : conflict.remote,
    tasks,
  );
  return local ? `Use my choice: ${value}` : `Keep YouTrack: ${value}`;
};

export const reviewResultMessage = (choice: "local" | "cloud" | "confirm") => {
  return choice === "local"
    ? "Your choice is ready to save to YouTrack."
    : choice === "cloud"
      ? "Your pending change was set aside. Nothing already saved was undone."
      : "Checked without sending the change again.";
};
