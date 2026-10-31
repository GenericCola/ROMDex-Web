import { indexTree, materialize } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { observeStatus } from "./assigned-status";
import { incomingHierarchyHeld, incomingHolds } from "./incoming-holds";
import {
  incomingTreeChanged,
  retireIncoming,
  validateIncomingStatus,
} from "./incoming-retirement";
import { cloudData } from "./types";
export const incomingProtectedData = (data: WorkspaceData) => {
  return JSON.stringify({
    ...data,
    remote: null,
    cloud: {
      ...cloudData(data),
      assigned: undefined,
      unavailable: undefined,
      rollupPending: undefined,
    },
  });
};
export const assertIncomingDelta = (
  before: WorkspaceData,
  after: WorkspaceData,
) => {
  validateIncomingStatus(before, after);
  if (incomingProtectedData(before) !== incomingProtectedData(after))
    throw Error(
      "An incoming refresh tried to change local work. Nothing was applied.",
    );
};
export const mergeIncoming = (
  data: WorkspaceData,
  items: TaskItem[],
  held: Set<string>,
  complete = true,
): boolean => {
  const ids = new Set<string>();
  for (const item of items) {
    validateTask(item);
    if (
      !/^PMON-\d+$/.test(item.id) ||
      !Number.isSafeInteger(item.updated) ||
      item.updated === null ||
      item.updated < 0 ||
      ids.has(item.id)
    )
      throw Error("Invalid or duplicate incoming task. Nothing was applied.");
    ids.add(item.id);
  }
  indexTree(items);
  const blocked = incomingHolds(data, held);
  if (blocked.has("*")) return false;
  const next = structuredClone(data);
  const byId = new Map(
    [
      ...next.remote,
      ...(cloudData(next).unavailable?.tasks ?? []).filter((item) => {
        return (
          ids.has(item.id) &&
          !next.remote.some((current) => {
            return current.id === item.id;
          })
        );
      }),
    ].map((item) => {
      return [item.id, item];
    }),
  );
  const all = [
    ...new Map(
      [...next.remote, ...items].map((item) => {
        return [item.id, item];
      }),
    ).values(),
  ];
  const statusData = {
    ...next,
    cloud: {
      ...cloudData(next),
      assigned: structuredClone(cloudData(next).assigned ?? {}),
    },
  };
  for (const incoming of items) {
    const previous = byId.get(incoming.id);
    if (
      blocked.has(incoming.id) ||
      incomingHierarchyHeld(data, all, incoming, blocked)
    ) {
      blocked.add(incoming.id);
      continue;
    }
    // Equal revisions with different content are not reliable new evidence.
    const revision = incoming.updated!;
    const observedRevision =
      cloudData(data).assigned?.[incoming.id]?.lastUpdated;
    if (
      (previous?.updated != null && revision <= previous.updated) ||
      (observedRevision != null && revision < observedRevision)
    )
      continue;
    const item = structuredClone(incoming);
    if (previous) {
      const comments = new Map(
        previous.comments.map((comment) => {
          return [comment.id, comment];
        }),
      );
      for (const comment of item.comments) comments.set(comment.id, comment);
      item.comments = [...comments.values()];
      item.commentCount = Math.max(
        previous.commentCount,
        item.commentCount,
        item.comments.length,
      );
    }
    if (previous && !statusData.cloud.assigned[item.id]) {
      statusData.cloud.assigned[item.id] = {
        assignedState: previous.assignedState ?? previous.state,
        lastState: previous.state,
        lastUpdated: previous.updated,
        pendingState: null,
      };
    }
    byId.set(item.id, observeStatus(statusData, item));
  }
  next.remote = [...byId.values()];
  // Native status observations are read-only; full tree changes schedule later work.
  next.cloud = { ...cloudData(data), assigned: statusData.cloud.assigned };
  if (
    !cloudData(data).assigned &&
    !Object.keys(statusData.cloud.assigned).length
  )
    delete next.cloud.assigned;
  if (complete) {
    retireIncoming(next, ids, blocked, data);
    if (incomingTreeChanged(data, next)) next.cloud.rollupPending = true;
  }
  if (
    JSON.stringify([next.remote, next.cloud]) ===
    JSON.stringify([data.remote, data.cloud])
  )
    return false;
  indexTree(next.remote, next.order);
  indexTree(materialize(next.remote, next.operations), next.order);
  assertIncomingDelta(data, next);
  data.remote = next.remote;
  data.cloud = next.cloud;
  return true;
};
