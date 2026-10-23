import type { WorkspaceData } from "./types";
const record = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
const strings = (value: unknown) => {
  return (
    record(value) &&
    Object.values(value).every((entry) => {
      return typeof entry === "string";
    })
  );
};
const nullableText = (value: unknown) => {
  return value === null || typeof value === "string";
};
const textList = (value: unknown) => {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      return typeof entry === "string";
    })
  );
};
export const validateView = (data: WorkspaceData) => {
  const { view } = data;
  if (
    !record(view) ||
    !["romdex", "npcdex"].includes(view.workspace) ||
    !["default", "expanded", "collapsed"].includes(view.detailsMode) ||
    !nullableText(view.scope) ||
    !nullableText(view.selected) ||
    typeof view.search !== "string" ||
    typeof view.hideCompleted !== "boolean" ||
    !textList(view.expanded) ||
    !textList(view.selectorExpanded) ||
    !Number.isFinite(view.workHeight) ||
    view.workHeight < 0 ||
    view.workHeight > 100 ||
    !strings(data.titleDrafts) ||
    !strings(data.commentDrafts) ||
    !record(data.order) ||
    !Object.values(data.order).every(Number.isFinite) ||
    (data.newTask !== null &&
      (!record(data.newTask) ||
        typeof data.newTask.title !== "string" ||
        !nullableText(data.newTask.parentId)))
  )
    throw Error(
      "The workspace layout or draft data is invalid. Existing browser data has been kept.",
    );
};
