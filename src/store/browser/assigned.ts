import { cloudData } from "@/cloud/types";
import { materialize } from "@/domain/accepted/core.mjs";
import type { WorkspaceData } from "@/domain/types";

/*
 * Everything about the article's `assigned` part lives in this file.
 * Other store code treats "assigned/<id>" as ordinary merge keys.
 */

/** One switch: false drops ROMDex's use of the article's `assigned` part (YouTrack's copy passes through untouched). */
export const ASSIGNED_IN_STORE = true;

const PREFIX = "assigned/";

export const assignedActive = (data: WorkspaceData): boolean => {
  return ASSIGNED_IN_STORE && !cloudData(data).sharedStatuses;
};

const assignedOnly = (
  values: Record<string, unknown> | null,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([key]) => {
      return key.startsWith(PREFIX);
    }),
  );
};

export const localAssignedWith = (
  enabled: boolean,
  data: WorkspaceData,
  base: Record<string, unknown> | null,
  remote: Record<string, unknown>,
): Record<string, unknown> => {
  if (!enabled) return assignedOnly(remote);
  const out = assignedOnly(base ?? remote);
  const known = new Set(Object.keys(assignedOnly(remote)));
  for (const key of Object.keys(assignedOnly(base))) known.add(key);
  const items = materialize(data.remote, data.operations);
  const inBrowser = new Set(
    data.remote.map((item) => {
      return item.id;
    }),
  );
  const parents = new Set(
    items.flatMap((item) => {
      return item.parentId === null ? [] : [item.parentId];
    }),
  );
  for (const item of items) {
    if (!inBrowser.has(item.id)) continue;
    const key = `${PREFIX}${item.id}`;
    if (parents.has(item.id) || known.has(key))
      out[key] = item.assignedState ?? item.state;
  }
  return out;
};

export const localAssigned = (
  data: WorkspaceData,
  base: Record<string, unknown> | null,
  remote: Record<string, unknown>,
): Record<string, unknown> => {
  return localAssignedWith(assignedActive(data), data, base, remote);
};

const stripPendingStatus = (data: WorkspaceData, id: string) => {
  data.operations = data.operations.flatMap((operation) => {
    if (
      operation.type !== "edit" ||
      operation.issueId !== id ||
      !Object.hasOwn(operation.patch, "assignedState")
    )
      return [operation];
    const patch = { ...operation.patch };
    delete patch.assignedState;
    return Object.keys(patch).length === 0 ? [] : [{ ...operation, patch }];
  });
};

const applyOne = (data: WorkspaceData, id: string, assignedState: string) => {
  const item = data.remote.find((entry) => {
    return entry.id === id;
  });
  if (!item) return false;
  data.remote = data.remote.map((entry) => {
    return entry === item ? { ...entry, assignedState } : entry;
  });
  const record = data.cloud?.assigned?.[id];
  if (record) record.assignedState = assignedState;
  else if (data.cloud) {
    data.cloud.assigned ??= {};
    data.cloud.assigned[id] = {
      assignedState,
      lastState: item.state,
      lastUpdated: item.updated,
      pendingState: null,
    };
  }
  stripPendingStatus(data, id);
  return true;
};

export const applyAssignedWith = (
  enabled: boolean,
  data: WorkspaceData,
  values: Record<string, unknown>,
  keys: string[],
): string[] => {
  if (!enabled) return [];
  const held: string[] = [];
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const value = values[key];
    if (typeof value !== "string") continue;
    if (!applyOne(data, key.slice(PREFIX.length), value)) held.push(key);
  }
  return held;
};

export const applyAssigned = (
  data: WorkspaceData,
  values: Record<string, unknown>,
  keys: string[],
): string[] => {
  return applyAssignedWith(assignedActive(data), data, values, keys);
};
