import type { TaskItem, TaskPatch } from "@/domain/types";
import { tagIds } from "./tag-types";
export const tagReconcileValues = (
  base: TaskItem,
  patch: TaskPatch,
  remote: TaskItem,
) => {
  if (patch.tags === undefined) return { base, patch, remote };
  // An absent baseline is not proof of an empty membership set.
  return {
    base: { ...base, tags: tagIds(base.tags) },
    patch: { ...patch, tags: tagIds(patch.tags) },
    remote: { ...remote, tags: tagIds(remote.tags) },
  };
};
