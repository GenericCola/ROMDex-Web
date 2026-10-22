import { indexTree } from "./accepted/core.mjs";
import type { WorkspaceData } from "./types";
export const emptyWorkspace = (): WorkspaceData => {
  return {
    schemaVersion: 1,
    newTask: null,
    titleDrafts: {},
    remote: [],
    operations: [],
    order: {},
    commentDrafts: {},
    view: {
      workspace: "romdex",
      scope: null,
      selected: null,
      search: "",
      hideCompleted: false,
      expanded: [],
      selectorExpanded: [],
      detailsMode: "default",
      workHeight: 46,
    },
  };
};
export const validateWorkspace = (value: unknown): WorkspaceData => {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1
  )
    throw Error(
      "Unsupported workspace format. Your existing browser data has been kept.",
    );
  const data = value as WorkspaceData;
  if (
    !Array.isArray(data.remote) ||
    !Array.isArray(data.operations) ||
    !data.view ||
    !data.order ||
    !data.commentDrafts
  )
    throw Error(
      "The workspace is incomplete. Your existing browser data has been kept.",
    );
  const ids = new Set<string>();
  for (const item of data.remote) {
    if (
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.summary !== "string" ||
      typeof item.description !== "string" ||
      !Array.isArray(item.comments)
    )
      throw Error(
        "Invalid task data. Your existing browser data has been kept.",
      );
    ids.add(item.id);
  }
  indexTree(data.remote, data.order);
  return data;
};
