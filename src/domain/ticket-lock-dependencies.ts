import type { WorkspaceData } from "./types";
export const ticketDependencies = (
  before: WorkspaceData,
  after: WorkspaceData,
  locked: Set<string>,
) => {
  const ids = new Set(locked);
  const edges: [string, string | null | undefined][] = [];
  for (const data of [before, after]) {
    for (const item of data.remote) edges.push([item.id, item.parentId]);
    for (const operation of data.operations) {
      if (operation.type === "create")
        edges.push([operation.issueId, operation.item.parentId]);
      if (operation.type === "edit") {
        edges.push([operation.issueId, operation.base.parentId]);
        edges.push([operation.issueId, operation.patch.parentId]);
      }
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, parent] of edges) {
      if (parent && ids.has(parent) && !ids.has(id)) {
        ids.add(id);
        changed = true;
      }
    }
  }
  return ids;
};

export const changesLockedHierarchy = (
  before: WorkspaceData,
  after: WorkspaceData,
  ids: Set<string>,
) => {
  for (const id of new Set(
    [...before.remote, ...after.remote].map((item) => {
      return item.id;
    }),
  )) {
    const prior = before.remote.find((item) => {
      return item.id === id;
    });
    const next = after.remote.find((item) => {
      return item.id === id;
    });
    if (!prior || !next || prior?.parentId !== next?.parentId) {
      const targets = new Set(
        [id, prior?.parentId, next?.parentId].filter(
          (value): value is string => {
            return typeof value === "string";
          },
        ),
      );
      if (
        [...ticketDependencies(before, after, targets)].some((target) => {
          return ids.has(target);
        })
      )
        return true;
    }
  }
  return false;
};

export const ticketGlobalData = (data: WorkspaceData) => {
  return {
    ...data,
    view: null,
    remote: null,
    operations: null,
    titleDrafts: null,
    commentDrafts: null,
    order: null,
    images: null,
    attachmentLists: null,
    newTask: null,
  };
};
