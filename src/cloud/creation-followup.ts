import type { TaskItem, TaskOperation, TaskPatch } from "@/domain/types";
import { equal } from "./delivery-helpers";
import { tagIds } from "./tag-types";
export const creationFollowup = (
  operation: Extract<TaskOperation, { type: "create" }>,
  remote: TaskItem,
  parentId: string | null,
): Extract<TaskOperation, { type: "edit" }> | null => {
  const patch: TaskPatch = {};
  if (remote.parentId !== parentId) patch.parentId = parentId;
  if (operation.item.tags !== undefined) {
    const target = tagIds(operation.item.tags);
    if (!equal(target, tagIds(remote.tags))) patch.tags = target;
  }
  if (!Object.keys(patch).length) return null;
  return {
    opId: operation.opId + (patch.parentId !== undefined ? ":parent" : ":tags"),
    type: "edit",
    issueId: remote.id,
    base: remote,
    patch,
  };
};
