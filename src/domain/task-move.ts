import { indexTree, materialize, validateMove } from "./accepted/core.mjs";
import type { DropIntent } from "./task-drop";
import { hierarchySignature } from "./task-drop";
import { commitTaskDrop } from "./task-drop-commit";
import { taskEditingLocked } from "./task-edit-lock";
import type { TaskItem, WorkspaceData } from "./types";
import { workspaceStore } from "./workspace-store";

// Exact placement uses the same preview, locking, draft flush and commit path as dragging.
export const exactMoveIntent = (
  data: WorkspaceData,
  id: string,
  parentId: string | null,
  beforeId: string | null,
): DropIntent | null => {
  const items = materialize(data.remote, data.operations);
  validateMove(items, id, parentId);
  const tree = indexTree(items, data.order);
  const siblings = (tree.children.get(parentId) ?? []).filter((item) => {
    return item.id !== id;
  });
  if (beforeId) {
    if (
      !siblings.some((item) => {
        return item.id === beforeId;
      })
    )
      throw Error("The insertion target no longer exists.");
    return { dragId: id, targetId: beforeId, delta: 0, after: false };
  }
  if (parentId)
    return { dragId: id, targetId: parentId, delta: 1, after: true };
  const last = siblings.at(-1);
  return last ? { dragId: id, targetId: last.id, delta: 0, after: true } : null;
};

export const taskPath = (byId: Map<string, TaskItem>, key: string) => {
  const names = [];
  let item = byId.get(key);
  while (item) {
    names.unshift(item.summary);
    item = item.parentId ? byId.get(item.parentId) : undefined;
  }
  return names.join(" / ");
};

export const commitExactTaskMove = async (
  data: WorkspaceData,
  id: string,
  parentId: string | null,
  beforeId: string | null,
  current: () => boolean,
) => {
  const available = () => {
    const state = workspaceStore.getSnapshot();
    if (!state.ready || state.updating)
      throw Error("Wait for the workspace to finish opening or updating.");
    if (taskEditingLocked(id))
      throw Error(
        "This task cannot be moved while it is locked or the workspace is in recovery mode.",
      );
    return current();
  };
  if (!available()) throw Error("The workspace changed. Move cancelled.");
  const intent = exactMoveIntent(data, id, parentId, beforeId);
  if (intent) await commitTaskDrop(intent, hierarchySignature(data), available);
};
