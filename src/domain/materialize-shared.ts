import type { TaskItem, TaskOperation } from "./types";
type Pending = TaskItem & {
  pendingAttachments?: object[];
  pendingAttachmentDeletes?: object[];
};
const copy = <T>(value: T): T => {
  return structuredClone(value);
};
const parentChainInvalid = (
  map: Map<string, TaskItem>,
  issueId: string,
  start: string | null | undefined,
): boolean => {
  if (!start) return false;
  if (!map.has(start)) return true;
  const seen = new Set<string>();
  let parent: string | null | undefined = start;
  while (parent) {
    if (parent === issueId || seen.has(parent)) return true;
    seen.add(parent);
    parent = map.get(parent)?.parentId;
  }
  return false;
};
// Same result as core materialize(), but items no operation touches stay the
// remote objects themselves. Callers must treat the output as read-only.
export const materializeShared = (
  remote: readonly TaskItem[],
  operations: readonly TaskOperation[],
): TaskItem[] => {
  const map = new Map<string, TaskItem>(
    remote.map((item) => {
      return [item.id, item] as const;
    }),
  );
  const owned = new Set<string>();
  const own = (id: string): Pending | undefined => {
    const item = map.get(id);
    if (!item) return undefined;
    if (owned.has(id)) return item;
    const mine = copy(item);
    map.set(id, mine);
    owned.add(id);
    return mine;
  };
  for (const op of operations) {
    if (op.type === "create") {
      map.set(op.issueId, copy(op.item));
      owned.add(op.issueId);
    } else if (op.type === "attachment") {
      const item = own(op.issueId);
      if (!item) continue;
      item.pendingAttachments ??= [];
      item.pendingAttachments.push({
        id: op.uploadId,
        opId: op.opId,
        ...copy(op.file),
      });
    } else if (op.type === "attachment-delete") {
      const item = own(op.issueId);
      if (!item) continue;
      item.pendingAttachmentDeletes ??= [];
      item.pendingAttachmentDeletes.push({
        id: op.attachmentId,
        opId: op.opId,
      });
    } else if (op.type === "edit") {
      if (!map.has(op.issueId)) continue;
      const patch = { ...op.patch };
      if ("state" in patch && !("assignedState" in patch))
        patch.assignedState = patch.state;
      if (
        "parentId" in patch &&
        parentChainInvalid(map, op.issueId, patch.parentId)
      )
        delete patch.parentId;
      const item = own(op.issueId);
      if (item) Object.assign(item, patch);
    } else if (op.type === "delete") {
      for (const id of op.ids) {
        map.delete(id);
        owned.delete(id);
      }
    }
  }
  return [...map.values()];
};
