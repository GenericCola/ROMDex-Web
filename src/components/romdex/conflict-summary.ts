import { equal } from "@/cloud/delivery-helpers";
import type { DeliveryRecord } from "@/cloud/types";
import type { TaskItem, TaskOperation } from "@/domain/types";
import {
  reviewConcise as concise,
  reviewFieldValue as display,
  reviewLabels as labels,
  reviewFieldLabel,
} from "./review-field-format";
import {
  proposedOperationSummary,
  reviewTaskSnapshots,
} from "./review-operation-summary";
export interface ConflictSummary {
  title: string;
  explanation: string;
  items: string[];
}
const differences = (base: TaskItem, remote: TaskItem) => {
  const result: string[] = [];
  for (const field of Object.keys(labels)) {
    const before: unknown = Reflect.get(base, field);
    const after: unknown = Reflect.get(remote, field);
    if (equal(before, after)) continue;
    result.push(
      field === "description"
        ? "Notes changed (text not shown)."
        : `${labels[field]}: ${display(field, before, [base, remote])} → ${display(field, after, [base, remote])}.`,
    );
  }
  const added = remote.commentCount - base.commentCount;
  if (added > 0)
    result.push(
      `${added} comment${added === 1 ? "" : "s"} added since review (${base.commentCount} → ${remote.commentCount}).`,
    );
  else if (added < 0)
    result.push(
      `Comment count changed: ${base.commentCount} → ${remote.commentCount}.`,
    );
  else if (!equal(base.comments, remote.comments))
    result.push(
      "Comment details differ in the available snapshots (text not shown).",
    );
  const ignored = new Set([
    ...Object.keys(labels),
    "id",
    "dbId",
    "url",
    "updated",
    "comments",
    "commentCount",
  ]);
  const fields = new Set([...Object.keys(base), ...Object.keys(remote)]);
  if (
    [...fields].some((field) => {
      return (
        !ignored.has(field) &&
        !equal(Reflect.get(base, field), Reflect.get(remote, field))
      );
    })
  )
    result.push("Other task fields changed; inspect YouTrack before deciding.");
  if (!result.length)
    result.push(
      base.updated !== remote.updated
        ? "The task revision changed; the available fields do not explain why. Inspect YouTrack."
        : "No difference is visible in these snapshots. Other evidence may still block deletion.",
    );
  return result;
};
export const conflictSummary = (
  operation: TaskOperation | undefined,
  record: DeliveryRecord,
  taskTitle?: string,
): ConflictSummary => {
  const title = taskTitle ?? record.remote?.summary;
  const summary: ConflictSummary = {
    title: operation
      ? `Review ${operation.issueId}${title ? " · " + concise(title) : ""}`
      : "Review queued change",
    explanation:
      "These are saved review snapshots, not a new read from YouTrack. Review the current task before deciding; nothing is resent by this summary.",
    items: [],
  };
  if (!operation) {
    summary.items.push(
      "The queued change is unavailable. Inspect YouTrack and recovery details before deciding.",
    );
    return summary;
  }
  if (operation.type === "delete") {
    summary.title = "Review listed task deletions";
    for (const id of operation.ids) {
      const base = operation.bases?.[id];
      const remote = record.remoteTasks?.find((item) => {
        return item.id === id;
      });
      const title = remote?.summary ?? base?.summary;
      const target = title ? `${id} · ${concise(title)}` : id;
      if (record.deletedIds?.includes(id)) {
        summary.items.push(
          `${target}: deletion was previously confirmed. Do not resend.`,
        );
      } else if (!base || !remote) {
        summary.items.push(
          `${target}: ${!remote ? "could not find the current task" : "original deletion review is unavailable"}.`,
        );
      } else {
        for (const change of differences(base, remote))
          summary.items.push(`${target}: ${change}`);
      }
    }
    if (!summary.items.length)
      summary.items.push("No deletion targets are available for review.");
    return summary;
  }
  const tasks = reviewTaskSnapshots(operation, record);
  summary.items.push(...proposedOperationSummary(operation, record));
  for (const conflict of record.conflicts ?? []) {
    const { field, base, local, remote } = conflict;
    summary.items.push(
      `${reviewFieldLabel(field, tasks)}: reviewed ${display(field, base, tasks)}; browser ${display(field, local, tasks)}; YouTrack ${display(field, remote, tasks)}.`,
    );
  }
  if (!record.conflicts?.length)
    summary.items.push(
      "No field comparison is available. Inspect the current task and read back the result before retrying.",
    );
  return summary;
};
