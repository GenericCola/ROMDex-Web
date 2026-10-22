import type { TaskItem, TaskPatch, WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
export const seedAssigned = (data: WorkspaceData) => {
  const cloud = cloudData(data);
  cloud.assigned ??= {};
  for (const item of data.remote)
    cloud.assigned[item.id] ??= {
      assignedState: item.assignedState ?? item.state,
      lastState: item.state,
      lastUpdated: item.updated,
      pendingState: null,
    };
  data.cloud = cloud;
};
export const observeStatus = (
  data: WorkspaceData,
  item: TaskItem,
): TaskItem => {
  if (!data.cloud?.assigned) seedAssigned(data);
  const cloud = cloudData(data);
  const records = cloud.assigned ?? {};
  const previous = records[item.id];
  if (
    typeof previous?.lastUpdated === "number" &&
    item.updated !== null &&
    item.updated < previous.lastUpdated
  )
    throw Error(
      "An older YouTrack status was returned. Refresh before delivery.",
    );
  if (cloud.sharedStatuses) {
    const shared = item.sharedStatus;
    if (shared?.state !== item.state || shared.updated !== item.updated)
      throw Error("Shared status is missing or stale. Nothing was replaced.");
    const known = data.remote.find((entry) => {
      return entry.id === item.id;
    })?.sharedStatus;
    if (known && shared.revision < known.revision)
      throw Error(
        "Shared status revision moved backwards. Preserve recovery and check the YouTrack app.",
      );
    records[item.id] = {
      assignedState: shared.assignedState,
      lastState: item.state,
      lastUpdated: item.updated,
      pendingState: null,
    };
    data.cloud = {
      ...cloud,
      assigned: records,
      ...(previous &&
      (previous.assignedState !== shared.assignedState ||
        previous.lastState !== item.state)
        ? { rollupPending: true }
        : {}),
    };
    return { ...item, assignedState: shared.assignedState };
  }
  const changed = previous !== undefined && item.state !== previous.lastState;
  const ours =
    previous !== undefined &&
    previous.pendingState !== null &&
    item.state === previous.pendingState;
  const assignedState = previous
    ? changed && !ours
      ? item.state
      : previous.assignedState
    : (item.assignedState ?? item.state);
  records[item.id] = {
    assignedState,
    lastState: item.state,
    lastUpdated: item.updated,
    pendingState: ours || changed ? null : (previous?.pendingState ?? null),
  };
  data.cloud = {
    ...cloud,
    assigned: records,
    ...(changed && !ours ? { rollupPending: true } : {}),
  };
  return { ...item, assignedState };
};
export const assignStatus = (
  data: WorkspaceData,
  item: TaskItem,
  value: string,
) => {
  const observed = observeStatus(data, item);
  const record = cloudData(data).assigned?.[item.id];
  if (!record) throw Error("Read the task before assigning its status.");
  record.assignedState = value;
  record.pendingState = null;
  return { ...observed, assignedState: value };
};
export const assignmentPatch = (patch: TaskPatch): TaskPatch => {
  const { state, assignedState, ...rest } = patch;
  if (
    state !== undefined &&
    assignedState !== undefined &&
    state !== assignedState
  )
    throw Error("A queued assignment has incompatible status values.");
  const value = assignedState ?? state;
  return value === undefined ? rest : { ...rest, assignedState: value };
};
export const adoptTasks = (data: WorkspaceData, items: TaskItem[]) => {
  data.remote = items.map((item) => {
    return observeStatus(data, item);
  });
};
