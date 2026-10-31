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
        return `Your proposed change — ${reviewFieldLabel(field, tasks)}: ${display(field, value, tasks)}.`;
      });
    case "create":
      return [
        `Create task: ${concise(operation.item.summary)}. Confirm an existing task by its exact YouTrack ID; do not create it again to test.`,
      ];
    case "comment":
      return [
        "Add a comment (text not shown). Check its exact saved comment before confirming; do not post it again to test.",
      ];
    case "attachment":
      return [
        `Upload ${concise(operation.file.name)} (${operation.file.size} bytes). Check the existing attachment ID and bytes; do not upload it again to test.`,
      ];
    case "attachment-delete":
      return [
        `Delete attachment ${concise(operation.base.name)} (${operation.attachmentId}). Check access and whether this exact file remains; do not resend its deletion.`,
      ];
    case "delete":
      return [
        `Delete listed tasks: ${operation.ids.join(", ")}. Only the reviewed targets are queued; inspect each before approving deletion.`,
      ];
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
  return local
    ? `Keep my ${reviewFieldLabel(conflict.field, tasks)}: ${value}; queue for Save`
    : `Keep YouTrack ${reviewFieldLabel(conflict.field, tasks)}: ${value}; archive mine`;
};

export const reviewResultMessage = (choice: "local" | "cloud" | "confirm") => {
  return choice === "local"
    ? "Your changes are queued against the latest task, not sent. Review the other paused items, then close Connection Details and use Save Changes."
    : choice === "cloud"
      ? "This pending change was stopped and archived. Earlier cloud changes were not undone. Review the remaining items before Save Changes."
      : "This result was checked without resending. Review the remaining paused items before Save Changes.";
};
