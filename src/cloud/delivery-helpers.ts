import type { TaskItem, TaskPatch, WorkspaceData } from "@/domain/types";
export const equal = (a: unknown, b: unknown) => {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
};
export const supported = (patch: TaskPatch) => {
  return Object.keys(patch).every((key) => {
    return [
      "summary",
      "description",
      "priority",
      "complexity",
      "parentId",
      "state",
      "assignedState",
    ].includes(key);
  });
};
export const replaceRemote = (data: WorkspaceData, item: TaskItem) => {
  const at = data.remote.findIndex((current) => {
    return current.id === item.id;
  });
  if (at < 0) data.remote.push(item);
  else data.remote[at] = item;
};
