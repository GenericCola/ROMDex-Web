import type {
  TaskItem,
  TaskOperation,
  TaskPatch,
  WorkspaceData,
} from "@/domain/types";
import { deliverTags } from "./tag-delivery";
import { tagIds } from "./tag-types";
import type { Commit, DeliveryPort } from "./types";
export const nativeTagBaseline = async (
  operation: TaskOperation,
  item: TaskItem,
  port: DeliveryPort,
) => {
  const needed =
    operation.type === "edit"
      ? operation.patch.tags !== undefined
      : operation.type === "create" && operation.item.tags !== undefined;
  if (!needed) return item;
  if (!port.tags) throw Error("Native tag delivery is unavailable.");
  return { ...item, tags: tagIds(await port.tags.list(item.id)) };
};
export const prepareEditPatch = async (
  operation: Extract<TaskOperation, { type: "edit" }>,
  patch: TaskPatch,
  remote: TaskItem,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  const { tags, ...fields } = patch;
  if (tags !== undefined) {
    if (!port.tags?.prepare || remote.tags === undefined)
      throw Error("Tag changes require fresh native preparation.");
    await port.tags.prepare(operation.issueId, tagIds(tags), remote.tags);
  }
  if (Object.keys(fields).length)
    await port.prepareUpdate?.(operation.issueId, fields, remote);
  return async () => {
    if (Object.keys(fields).length)
      await port.update(operation.issueId, fields, remote);
    if (tags !== undefined) {
      if (!port.tags || remote.tags === undefined)
        throw Error("Native tag preparation was lost.");
      await deliverTags(
        operation,
        remote.tags,
        tags,
        snapshot,
        commit,
        port.tags,
      );
    }
  };
};
