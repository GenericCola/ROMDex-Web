import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { DeletionReviewRequired } from "./deletion-isolation";
import { equal } from "./delivery-helpers";
import type { DeliveryPort } from "./types";
import { cloudData } from "./types";
export type Deletion = Extract<TaskOperation, { type: "delete" }>;
const fields = [
  "summary",
  "description",
  "state",
  "parentId",
  "priority",
  "complexity",
  "type",
  "updated",
  "commentCount",
] as const;
export const remainingDeletion = (data: WorkspaceData, operation: Deletion) => {
  const done = cloudData(data).records[operation.opId]?.deletedIds ?? [];
  return operation.ids.filter((id) => {
    return !done.includes(id);
  });
};
export const readDeletion = async (ids: string[], port: DeliveryPort) => {
  const items: TaskItem[] = [];
  for (const id of ids) {
    const item = await port.get(id);
    if (!item)
      throw new DeletionReviewRequired(
        "A deletion target is missing or unreadable. Review it; no retry was sent.",
      );
    if (!Number.isFinite(item.updated))
      throw new DeletionReviewRequired(
        "A deletion target has no verifiable revision timestamp.",
      );
    const children = await port.children(id);
    if (
      children.some((child) => {
        return !ids.includes(child);
      })
    )
      throw new DeletionReviewRequired(
        "An unreviewed child blocks deletion. Refresh and review the exact list first.",
      );
    items.push(item);
  }
  return items;
};
export const sameDeletion = (
  base: TaskItem | undefined,
  item: TaskItem | undefined,
) => {
  return (
    !!base &&
    !!item &&
    fields.every((key) => {
      return equal(base[key], item[key]);
    })
  );
};
