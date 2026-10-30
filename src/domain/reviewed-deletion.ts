import { descendants, materialize } from "./accepted/core.mjs";
import { deleteTask } from "./task-actions";
import type { TaskItem, WorkspaceData } from "./types";
export const deletionSnapshot = (items: TaskItem[], id: string) => {
  const ids = new Set([id, ...descendants(items, id)]);
  return structuredClone(
    items.filter((item) => {
      return ids.has(item.id);
    }),
  );
};
export const queueReviewedDeletion = (
  data: WorkspaceData,
  id: string,
  reviewed: TaskItem[],
) => {
  const current = deletionSnapshot(
    materialize(data.remote, data.operations),
    id,
  );
  if (
    !reviewed.some((item) => {
      return item.id === id;
    }) ||
    current.length !== reviewed.length ||
    current.some((item) => {
      const before = reviewed.find((prior) => {
        return prior.id === item.id;
      });
      return !before || JSON.stringify(before) !== JSON.stringify(item);
    })
  )
    throw Error(
      "The listed tasks changed. Close and review the deletion again.",
    );
  deleteTask(data, id);
};
