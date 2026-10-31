import { indexTree, STATES, youTrackState } from "@/domain/accepted/core.mjs";
import type { WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
import {
  availabilityFingerprint,
  validateUnavailable,
} from "./unavailable-tasks";
export const pendingAssignedStatusIds = (data: WorkspaceData) => {
  const tree = indexTree(data.remote);
  return new Set(
    Object.entries(cloudData(data).assigned ?? {})
      .filter(([id, value]) => {
        if (!tree.byId.has(id)) return value.pendingState !== null;
        const color = tree.colors.get(id);
        const desired =
          tree.children.get(id)?.length && color
            ? youTrackState(STATES[color])
            : youTrackState(value.assignedState);
        return value.pendingState !== null || desired !== value.lastState;
      })
      .map(([id]) => {
        return id;
      }),
  );
};
// Only a completed, validated full snapshot reaches this method. Omission is
// membership evidence, not proof of deletion; retain an account-bound copy.
export const retireIncoming = (
  data: WorkspaceData,
  present: Set<string>,
  held: Set<string>,
  baseline: WorkspaceData = data,
) => {
  const cloud = cloudData(data);
  const previous = cloud.unavailable;
  const before = JSON.stringify([data.remote, previous]);
  const linkedMissingIds = (previous?.linkedMissingIds ?? []).filter((id) => {
    return !present.has(id);
  });
  const protectedIds = new Set([
    ...held,
    ...pendingAssignedStatusIds(baseline),
  ]);
  const rows = new Map(
    data.remote.map((item) => {
      return [item.id, item];
    }),
  );
  const keep = new Set([...present, ...protectedIds]);
  for (const id of protectedIds) {
    let parent = rows.get(id)?.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      keep.add(parent);
      parent = rows.get(parent)?.parentId;
    }
  }
  const archived = new Map(
    (cloud.unavailable?.tasks ?? []).map((item) => {
      return [item.id, item];
    }),
  );
  for (const [id, item] of rows) {
    if (!present.has(id)) archived.set(id, structuredClone(item));
    if (!keep.has(id)) rows.delete(id);
  }
  for (const id of present) archived.delete(id);
  data.remote = [...rows.values()];
  if (archived.size || linkedMissingIds.length) {
    if (!cloud.accountId)
      throw Error(
        "Reconnect this workspace before replacing its cached tasks.",
      );
    const missingIds = [...new Set([...archived.keys(), ...linkedMissingIds])];
    const blockedIds = [
      ...new Set([
        ...[...protectedIds].filter((id) => {
          return archived.has(id);
        }),
        ...(linkedMissingIds.length
          ? (previous?.blockedIds ?? []).filter((id) => {
              return present.has(id);
            })
          : []),
      ]),
    ];
    cloud.unavailable = {
      accountId: cloud.accountId,
      project: "PMON",
      tasks: [...archived.values()],
      missingIds,
      blockedIds,
      ...(linkedMissingIds.length ? { linkedMissingIds } : {}),
      fingerprint:
        linkedMissingIds.length && previous
          ? previous.fingerprint
          : availabilityFingerprint(data, missingIds, blockedIds),
    };
    const candidate = cloud.unavailable;
    if (
      previous &&
      JSON.stringify({ ...previous, ...candidate }) ===
        JSON.stringify(previous) &&
      JSON.stringify({ ...candidate, ...previous }) ===
        JSON.stringify(candidate)
    )
      cloud.unavailable = previous;
  } else delete cloud.unavailable;
  return before !== JSON.stringify([data.remote, cloud.unavailable]);
};

export const incomingTreeChanged = (
  before: WorkspaceData,
  after: WorkspaceData,
) => {
  const projection = (data: WorkspaceData) => {
    const missing = new Set(cloudData(data).unavailable?.missingIds ?? []);
    return JSON.stringify(
      data.remote
        .filter((item) => {
          return !missing.has(item.id);
        })
        .map((item) => {
          return [
            item.id,
            item.parentId,
            item.state,
            item.assignedState ?? item.state,
          ];
        })
        .sort((a, b) => {
          return String(a[0]).localeCompare(String(b[0]));
        }),
    );
  };
  return projection(before) !== projection(after);
};

export const validateIncomingStatus = (
  before: WorkspaceData,
  after: WorkspaceData,
) => {
  validateUnavailable(after);
  const prior = cloudData(before).rollupPending,
    next = cloudData(after).rollupPending;
  if (prior !== next && !(prior !== true && next === true))
    throw Error("An incoming refresh tried to clear pending status work.");
};
