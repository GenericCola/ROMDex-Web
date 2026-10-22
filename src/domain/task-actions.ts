import { cloudData } from "@/cloud/types";
import { descendants, materialize, validateMove } from "./accepted/core.mjs";
import type { TaskItem, TaskPatch, WorkspaceData } from "./types";
const requireReviewClear = (data: WorkspaceData) => {
  if (
    Object.values(cloudData(data).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error("Review cloud delivery before changing the queue.");
};
export const createTask = (
  data: WorkspaceData,
  parentId: string | null,
  title: string,
): string => {
  requireReviewClear(data);
  const summary = title.trim();
  if (!summary) throw Error("Enter an item name.");
  if (
    parentId &&
    !materialize(data.remote, data.operations).some((item) => {
      return item.id === parentId;
    })
  )
    throw Error("The parent no longer exists.");
  const id = "local-" + crypto.randomUUID();
  const item: TaskItem = {
    id,
    summary,
    description: "",
    parentId,
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: parentId ? "Task" : "Epic",
    updated: null,
    comments: [],
    commentCount: 0,
  };
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "create",
    issueId: id,
    item,
  });
  return id;
};
export const editTask = (data: WorkspaceData, id: string, patch: TaskPatch) => {
  requireReviewClear(data);
  const items = materialize(data.remote, data.operations);
  const item = items.find((candidate) => {
    return candidate.id === id;
  });
  if (!item) throw Error("The item no longer exists.");
  if (patch.summary !== undefined && !patch.summary.trim())
    throw Error("Enter an item name.");
  if (patch.parentId !== undefined) validateMove(items, id, patch.parentId);
  const last = [...data.operations].reverse().find((operation) => {
    return operation.issueId === id;
  });
  if (last?.type === "create") {
    Object.assign(last.item, patch);
    return;
  }
  if (last?.type === "edit") {
    Object.assign(last.patch, patch);
    return;
  }
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "edit",
    issueId: id,
    base: structuredClone(item),
    patch,
  });
};
export const deleteTask = (data: WorkspaceData, id: string) => {
  requireReviewClear(data);
  const items = materialize(data.remote, data.operations);
  const ids = [id, ...descendants(items, id)];
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "delete",
    issueId: id,
    ids,
  });
  if (data.view.selected && ids.includes(data.view.selected))
    data.view.selected = null;
  if (data.view.scope && ids.includes(data.view.scope)) data.view.scope = null;
};
export const postComment = (data: WorkspaceData, id: string) => {
  requireReviewClear(data);
  const text = data.commentDrafts[id]?.trim();
  if (!text) return;
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "comment",
    issueId: id,
    text,
    created: Date.now(),
  });
  delete data.commentDrafts[id];
};
