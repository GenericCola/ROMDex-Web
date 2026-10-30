import { cloudData } from "@/cloud/types";
import { indexTree, materialize } from "./accepted/core.mjs";
import { bulkMovePlan, siblingSelection } from "./bulk-selection";
import { createTask } from "./task-actions";
import { hierarchySignature } from "./task-drop";
import type { TaskItem, WorkspaceData } from "./types";
export { bulkMovePlan, siblingSelection } from "./bulk-selection";

const queueMove = (
  data: WorkspaceData,
  item: TaskItem,
  parentId: string | null,
) => {
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "edit",
    issueId: item.id,
    base: structuredClone(item),
    patch: { parentId },
  });
};
const safeDraft = (data: WorkspaceData, expected: string) => {
  if (hierarchySignature(data) !== expected)
    throw Error("The hierarchy changed. Review the selection again.");
  if (
    Object.values(cloudData(data).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error("Review cloud delivery before changing the queue.");
  return structuredClone(data);
};
export const stageMove = (
  data: WorkspaceData,
  ids: string[],
  parentId: string | null,
  beforeId: string | null,
  expected: string,
) => {
  const next = safeDraft(data, expected);
  const plan = bulkMovePlan(
    materialize(next.remote, next.operations),
    next.order,
    ids,
    parentId,
    beforeId,
  );
  for (const item of plan.members)
    if (item.parentId !== parentId) queueMove(next, item, parentId);
  plan.destination.forEach((item, index) => {
    next.order[item.id] = index;
  });
  if (parentId && !next.view.expanded.includes(parentId))
    next.view.expanded.push(parentId);
  indexTree(materialize(next.remote, next.operations), next.order);
  Object.assign(data, next);
};
export const stageGroup = (
  data: WorkspaceData,
  ids: string[],
  title: string,
  expected: string,
) => {
  const next = safeDraft(data, expected);
  const selection = siblingSelection(
    materialize(next.remote, next.operations),
    next.order,
    ids,
  );
  if (!title.trim()) throw Error("Enter a Parent Title.");
  const createdParentId = createTask(next, selection.parentId, title);
  const creation = next.operations.at(-1);
  const depth = selection.parentId
    ? (selection.tree.depths.get(selection.parentId) ?? 0) + 1
    : 0;
  if (creation?.type === "create")
    creation.item.type = depth === 0 ? "Epic" : depth <= 3 ? "Feature" : "Task";
  const keys = new Set(ids),
    destination: string[] = [];
  for (const sibling of selection.tree.children.get(selection.parentId) ?? []) {
    if (!keys.has(sibling.id)) destination.push(sibling.id);
    else if (!destination.includes(createdParentId))
      destination.push(createdParentId);
  }
  selection.members.forEach((item, index) => {
    queueMove(next, item, createdParentId);
    next.order[item.id] = index;
  });
  destination.forEach((id, index) => {
    next.order[id] = index;
  });
  next.view.expanded = [...new Set([...next.view.expanded, createdParentId])];
  indexTree(materialize(next.remote, next.operations), next.order);
  Object.assign(data, next);
  return createdParentId;
};
