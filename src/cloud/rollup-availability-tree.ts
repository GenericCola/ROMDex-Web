import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { incomingHolds } from "./incoming-holds";
import { cloudData } from "./types";
export const availabilityTree = (
  data: WorkspaceData,
  previous: Map<string, TaskItem>,
  fresh: Map<string, TaskItem>,
  missing: Set<string>,
  gone: Set<string>,
  denied: Set<string>,
) => {
  const combined = new Map([...previous, ...fresh]);
  const unavailable = new Map<string, TaskItem>();
  for (const id of [...missing, ...gone]) {
    const item = previous.get(id);
    if (item) unavailable.set(id, item);
  }
  // A newly unreadable parent must not turn its child into a new root.
  const invalid = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of combined.values()) {
      if (invalid.has(item.id) || !item.parentId) continue;
      if (!combined.has(item.parentId) || invalid.has(item.parentId)) {
        invalid.add(item.id);
        missing.add(item.parentId);
        changed = true;
      }
    }
  }
  for (const id of invalid) {
    const item = combined.get(id)!;
    unavailable.set(id, item);
    const old = previous.get(id);
    if (old && (!old.parentId || previous.has(old.parentId)))
      combined.set(id, old);
    else combined.delete(id);
  }
  let dangling = true;
  while (dangling) {
    dangling = false;
    for (const [id, item] of combined) {
      if (item.parentId && !combined.has(item.parentId)) {
        unavailable.set(id, item);
        invalid.add(id);
        missing.add(item.parentId);
        combined.delete(id);
        dangling = true;
      }
    }
  }
  const blocked = new Set([...missing, ...invalid]);
  // Block only the missing node's descendants and ancestors, not its siblings.
  for (const id of [...missing, ...invalid]) {
    let parent = combined.get(id)?.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      blocked.add(parent);
      parent = combined.get(parent)?.parentId;
    }
  }
  const descendants = new Set([...missing, ...invalid]);
  changed = true;
  while (changed) {
    changed = false;
    for (const item of combined.values())
      if (
        item.parentId &&
        descendants.has(item.parentId) &&
        !descendants.has(item.id)
      ) {
        descendants.add(item.id);
        blocked.add(item.id);
        changed = true;
      }
  }
  const protectedIds = incomingHolds(data, new Set());
  const pendingIds = new Set<string>();
  for (const id of missing) {
    const assignment = cloudData(data).assigned?.[id];
    if (
      assignment &&
      (assignment.pendingState !== null ||
        assignment.assignedState !== assignment.lastState)
    ) {
      protectedIds.add(id);
      pendingIds.add(id);
    }
  }
  // Retire only wholly unavailable, clean components. Their full copies stay in history.
  const retained = new Set([...fresh.keys(), ...protectedIds, ...denied]);
  changed = true;
  while (changed) {
    changed = false;
    for (const item of combined.values()) {
      if (!item.parentId) continue;
      if (retained.has(item.id) && !retained.has(item.parentId)) {
        retained.add(item.parentId);
        changed = true;
      }
      if (retained.has(item.parentId) && !retained.has(item.id)) {
        retained.add(item.id);
        changed = true;
      }
    }
  }
  for (const [id, item] of combined)
    if (!retained.has(id)) {
      unavailable.set(id, item);
      combined.delete(id);
    }
  for (const id of gone) {
    if (
      [...combined.values()].some((item) => {
        return item.parentId === id;
      })
    ) {
      blocked.add(id);
      for (const item of combined.values())
        if (item.parentId === id) blocked.add(item.id);
    } else if (!protectedIds.has(id)) combined.delete(id);
  }
  const items = [...combined.values()];
  indexTree(items);
  return {
    items,
    fresh,
    unavailable: [...unavailable.values()],
    missingIds: [...missing],
    deniedIds: [...denied],
    blocked,
    pendingIds,
  };
};
