import { cloudData } from "@/cloud/types";
import { indexTree, materialize, validateMove } from "./accepted/core.mjs";
import { editTask } from "./task-actions";
import type { TaskItem, WorkspaceData } from "./types";
export interface DropIntent {
  dragId: string;
  targetId: string;
  delta: number;
  after: boolean;
}
export interface DropTarget {
  parentId: string | null;
  beforeId: string | null;
  anchorId: string;
  after: boolean;
  depth: number;
}
// Ported from desktop drop-target.mjs at ROMDex 28c0ce4; no invented level cap.
export const rowDropTarget = (
  items: TaskItem[],
  order: WorkspaceData["order"],
  intent: DropIntent,
  visibleIds: string[],
): DropTarget | null => {
  if (!Number.isSafeInteger(intent.delta))
    throw Error("Invalid hierarchy level.");
  const tree = indexTree(items, order);
  let anchor = tree.byId.get(intent.targetId);
  if (!anchor || anchor.id === intent.dragId) return null;
  let parentId: string | null;
  let beforeId: string | null = null;
  const after = intent.delta > 0 || intent.after;
  if (intent.delta > 0) parentId = anchor.id;
  else {
    for (let step = 0; step < -intent.delta && anchor.parentId; step++) {
      const parent = tree.byId.get(anchor.parentId);
      if (!parent) throw Error("The destination no longer exists.");
      anchor = parent;
    }
    ({ parentId } = anchor);
    const siblings = tree.children.get(parentId) ?? [];
    const anchorKey = anchor.id;
    const at = siblings.findIndex((item) => {
      return item.id === anchorKey;
    });
    beforeId = siblings[at + (after ? 1 : 0)]?.id ?? null;
  }
  validateMove(items, intent.dragId, parentId);
  const depth = parentId ? (tree.depths.get(parentId) ?? 0) + 1 : 0;
  let anchorId = anchor.id;
  if (after) {
    const start = visibleIds.indexOf(anchorId),
      anchorDepth = tree.depths.get(anchorId) ?? 0;
    for (let i = start + 1; start >= 0 && i < visibleIds.length; i++) {
      const id = visibleIds[i];
      if (!id || (tree.depths.get(id) ?? 0) <= anchorDepth) break;
      anchorId = id;
    }
  }
  if (!visibleIds.includes(anchorId)) {
    const branch = visibleIds.filter((id) => {
      let item = tree.byId.get(id);
      while (item) {
        if (item.id === anchor.id) return true;
        item = item.parentId ? tree.byId.get(item.parentId) : undefined;
      }
      return false;
    });
    anchorId = (after ? branch.at(-1) : branch[0]) ?? anchorId;
  }
  return { parentId, beforeId, anchorId, after, depth };
};
export const hierarchySignature = (data: WorkspaceData) => {
  return JSON.stringify([
    materialize(data.remote, data.operations).map((item) => {
      return [item.id, item.parentId];
    }),
    data.order,
  ]);
};
export const applyTaskDrop = (
  data: WorkspaceData,
  intent: DropIntent,
  expected: string,
) => {
  if (hierarchySignature(data) !== expected)
    throw Error("The hierarchy changed during the drag. Try again.");
  const items = materialize(data.remote, data.operations),
    tree = indexTree(items, data.order);
  const target = rowDropTarget(items, data.order, intent, []);
  if (!target) return;
  const item = tree.byId.get(intent.dragId);
  if (!item) throw Error("The task no longer exists.");
  if (
    Object.values(cloudData(data).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error("Review cloud delivery before changing the queue.");
  if (item.parentId !== target.parentId)
    editTask(data, item.id, { parentId: target.parentId });
  const siblings = (tree.children.get(target.parentId) ?? []).filter(
    (entry) => {
      return entry.id !== item.id;
    },
  );
  const at =
    target.beforeId === item.id
      ? (tree.children.get(target.parentId) ?? []).findIndex((entry) => {
          return entry.id === item.id;
        })
      : siblings.findIndex((entry) => {
          return entry.id === target.beforeId;
        });
  siblings.splice(at < 0 ? siblings.length : at, 0, item);
  siblings.forEach((entry, index) => {
    data.order[entry.id] = index;
  });
  if (target.parentId && !data.view.expanded.includes(target.parentId))
    data.view.expanded.push(target.parentId);
};
