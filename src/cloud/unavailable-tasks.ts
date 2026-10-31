import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { cloudData } from "./types";
export interface UnavailableTasks {
  accountId: string;
  project: "PMON";
  tasks: TaskItem[];
  missingIds: string[];
  deniedIds?: string[];
  linkedMissingIds?: string[];
  blockedIds: string[];
  fingerprint: string;
}
export const availabilityFingerprint = (
  data: WorkspaceData,
  missing: string[] = [],
  blocked: string[] = [],
) => {
  const relevant = new Set([...missing, ...blocked]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of data.remote)
      if (
        item.parentId &&
        relevant.has(item.parentId) &&
        !relevant.has(item.id)
      ) {
        relevant.add(item.id);
        changed = true;
      }
  }
  return JSON.stringify(
    data.remote
      .filter((item) => {
        return relevant.has(item.id);
      })
      .map((item) => {
        return [item.id, item.updated, item.parentId];
      }),
  );
};
export const deferredStatusChanged = (data: WorkspaceData) => {
  const held = cloudData(data).unavailable;
  return (
    !!held?.blockedIds.length &&
    held.fingerprint !==
      availabilityFingerprint(data, held.missingIds, held.blockedIds)
  );
};
export const validateUnavailable = (data: WorkspaceData) => {
  const held = data.cloud?.unavailable;
  if (held === undefined) return;
  if (
    !held ||
    typeof held.accountId !== "string" ||
    !held.accountId ||
    held.accountId !== data.cloud?.accountId ||
    held.project !== "PMON" ||
    typeof held.fingerprint !== "string" ||
    !Array.isArray(held.tasks) ||
    !Array.isArray(held.missingIds) ||
    !Array.isArray(held.blockedIds) ||
    (held.deniedIds !== undefined && !Array.isArray(held.deniedIds)) ||
    (held.linkedMissingIds !== undefined &&
      !Array.isArray(held.linkedMissingIds))
  )
    throw Error(
      "Unavailable task history belongs to a different workspace or is invalid.",
    );
  const ids = new Set<string>();
  for (const item of held.tasks) {
    validateTask(item);
    if (!/^PMON-\d+$/.test(item.id) || ids.has(item.id))
      throw Error("Invalid unavailable task history.");
    ids.add(item.id);
  }
  for (const list of [
    held.missingIds,
    held.blockedIds,
    held.deniedIds ?? [],
    held.linkedMissingIds ?? [],
  ])
    if (
      !Array.isArray(list) ||
      new Set(list).size !== list.length ||
      list.some((id) => {
        return typeof id !== "string" || !/^[A-Za-z][\w-]*-\d+$/.test(id);
      })
    )
      throw Error("Invalid unavailable task identifiers.");
};

export const statusReadNeeded = (data: WorkspaceData) => {
  return !!cloudData(data).rollupPending || deferredStatusChanged(data);
};

export const deliveryCompletion = (data: WorkspaceData) => {
  if (data.operations.length)
    return "Current delivery finished. Additional changes remain safely queued.";
  const held = cloudData(data).unavailable;
  return held?.blockedIds.length
    ? `Your ticket edits saved. Status updates for ${held.blockedIds.join(", ")} are waiting because ${held.missingIds.join(", ")} could not be read. Other changes can sync.`
    : "Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.";
};
