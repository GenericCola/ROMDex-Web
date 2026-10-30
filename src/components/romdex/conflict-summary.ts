import { equal } from "@/cloud/delivery-helpers";
import type { DeliveryRecord } from "@/cloud/types";
import type { TaskItem, TaskOperation } from "@/domain/types";
export interface ConflictSummary {
  title: string;
  explanation: string;
  items: string[];
}
const labels: Record<string, string> = {
  summary: "Title",
  description: "Notes",
  state: "State",
  assignedState: "Assigned status",
  priority: "Priority",
  complexity: "Complexity",
  parentId: "Parent",
  type: "Task type",
  assignee: "Assignee",
  assignees: "Assignees",
  dueDate: "Due date",
  tags: "Tags",
  tagNames: "Tags",
};
const concise = (value: string) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
};
const display = (field: string, value: unknown): string => {
  if (value === undefined) return "not available";
  if (value === null || value === "") return "none";
  if (!Object.hasOwn(labels, field) || field === "description")
    return "content withheld";
  if (typeof value === "string") return concise(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "structured value";
};
const differences = (base: TaskItem, remote: TaskItem) => {
  const result: string[] = [];
  for (const field of Object.keys(labels)) {
    const before: unknown = Reflect.get(base, field);
    const after: unknown = Reflect.get(remote, field);
    if (equal(before, after)) continue;
    result.push(
      field === "description"
        ? "Notes changed (text not shown)."
        : `${labels[field]}: ${display(field, before)} → ${display(field, after)}.`,
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
): ConflictSummary => {
  const summary: ConflictSummary = {
    title: operation ? `Review ${operation.issueId}` : "Review queued change",
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
          `${target}: ${!base ? "reviewed baseline" : "current task snapshot"} unavailable. Missing evidence does not prove deletion or access; inspect YouTrack.`,
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
  for (const conflict of record.conflicts ?? []) {
    const { field, base, local, remote } = conflict;
    summary.items.push(
      `${Object.hasOwn(labels, field) ? labels[field] : "Other task field"}: reviewed ${display(field, base)}; browser ${display(field, local)}; YouTrack ${display(field, remote)}.`,
    );
  }
  if (!summary.items.length)
    summary.items.push(
      "No field comparison is available. Inspect the current task and read back the result before retrying.",
    );
  return summary;
};
