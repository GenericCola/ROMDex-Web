import {
  changesLockedHierarchy,
  ticketDependencies as dependencies,
  ticketGlobalData as globalData,
} from "./ticket-lock-dependencies";
import type { TaskOperation, WorkspaceData } from "./types";
import { withoutUnsentArchives } from "./unsent-archives";
const same = (left: unknown, right: unknown) => {
  return JSON.stringify(left) === JSON.stringify(right);
};
const refused = () => {
  throw Error(
    "This ticket or its dependencies are being synchronized or need review.",
  );
};
export const operationTicketIds = (operation: TaskOperation): Set<string> => {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id != null) {
      if (typeof id !== "string" || !id || id === "*") refused();
      ids.add(id);
    }
  };
  if (!operation.issueId || !operation.opId) refused();
  add(operation.issueId);
  if (operation.type === "delete") {
    operation.ids.forEach(add);
    for (const item of Object.values(operation.bases ?? {})) {
      add(item.id);
      add(item.parentId);
    }
  } else if (operation.type === "edit" && "parentId" in operation.patch) {
    add(operation.base.parentId);
    add(operation.patch.parentId);
  } else if (operation.type === "create") {
    add(operation.item.id);
    add(operation.item.parentId);
  } else if (
    !["edit", "comment", "attachment", "attachment-delete"].includes(
      operation.type,
    )
  ) {
    refused();
  }
  return ids;
};
export const reviewedTicketIds = (data: WorkspaceData): Set<string> => {
  const ids = new Set<string>();
  for (const [opId, record] of Object.entries(data.cloud?.records ?? {})) {
    if (!record) {
      ids.add("*");
      continue;
    }
    if (record.status === "confirmed") continue;
    const matches = data.operations.filter((operation) => {
      return operation.opId === opId;
    });
    if (
      matches.length !== 1 ||
      !matches[0] ||
      !["ready", "conflict", "attempting", "uncertain"].includes(record.status)
    ) {
      ids.add("*");
      continue;
    }
    try {
      for (const id of operationTicketIds(matches[0])) ids.add(id);
    } catch {
      ids.add("*");
    }
  }
  return ids;
};
export const guardTicketChanges = (
  before: WorkspaceData,
  after: WorkspaceData,
  locked: Set<string>,
) => {
  if (!locked.size) return;
  if (locked.has("*")) {
    if (!same({ ...before, view: null }, { ...after, view: null })) refused();
    return;
  }
  const compared = withoutUnsentArchives(
    before,
    after,
    locked,
    operationTicketIds,
  );
  if (!same(globalData(before), globalData(compared))) refused();
  const ids = new Set(locked);
  for (const field of [
    "titleDrafts",
    "commentDrafts",
    "order",
    "images",
    "attachmentLists",
  ] as const) {
    for (const id of ids)
      if (!same(before[field]?.[id], after[field]?.[id])) refused();
  }
  for (const id of ids) {
    if (
      !same(
        before.remote.filter((item) => {
          return item.id === id;
        }),
        after.remote.filter((item) => {
          return item.id === id;
        }),
      )
    )
      refused();
  }
  if (changesLockedHierarchy(before, after, ids)) refused();
  const affected = (operation: TaskOperation) => {
    const targets = operationTicketIds(operation);
    const structural =
      operation.type === "delete" ||
      (operation.type === "edit" && "parentId" in operation.patch);
    // A shared parent is a direct dependency, not a reason to lock siblings.
    // Descendants matter only below the subtree actually being moved/deleted.
    const roots = new Set(
      operation.type === "delete" ? operation.ids : [operation.issueId],
    );
    const touched = structural
      ? new Set([...targets, ...dependencies(before, after, roots)])
      : targets;
    return [...touched].some((id) => {
      return ids.has(id);
    });
  };
  if (
    !same(before.operations.filter(affected), after.operations.filter(affected))
  )
    refused();
  if (!same(before.newTask, after.newTask)) {
    for (const draft of [before.newTask, after.newTask]) {
      if (
        draft &&
        ((draft.parentId && ids.has(draft.parentId)) ||
          (draft.afterId && ids.has(draft.afterId)))
      )
        refused();
    }
  }
};
