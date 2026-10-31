import type { RecoveryScope } from "./order-recovery";
import type { TaskItem, WorkspaceData } from "./types";
import { validateTask } from "./validate-task";
export interface HierarchyPreview {
  baseline: string;
  blockedReason?: string;
  scope: RecoveryScope;
  serverParents: Record<string, string | null>;
  items: {
    id: string;
    opId?: string;
    issueId: string;
    summary: string;
    localParentId: string | null;
    serverParentId: string | null;
    blockedReason?: string;
  }[];
}
export const assertHierarchyScope = (
  data: WorkspaceData,
  scope: RecoveryScope,
) => {
  if (
    scope.userId !== "2-2" ||
    !scope.projectId ||
    (data.cloud?.accountId && data.cloud.accountId !== scope.userId)
  )
    throw Error(
      "This recovery is restricted to the incident account and PMON project.",
    );
};
export const previewHierarchyRecovery = (
  data: WorkspaceData,
  server: TaskItem[],
  scope: RecoveryScope,
): HierarchyPreview => {
  assertHierarchyScope(data, scope);
  const parents: Record<string, string | null> = {};
  for (const item of server) {
    validateTask(item);
    if (!/^PMON-[1-9]\d*$/.test(item.id) || Object.hasOwn(parents, item.id))
      throw Error("Server hierarchy contains an unknown or duplicate task.");
    parents[item.id] = item.parentId;
  }
  for (const id of Object.keys(parents)) {
    const seen = new Set<string>();
    let next: string | null = id;
    while (next !== null) {
      if (!Object.hasOwn(parents, next) || seen.has(next))
        throw Error("Server hierarchy is incomplete or contains a cycle.");
      seen.add(next);
      next = parents[next] ?? null;
    }
  }
  const uncertain = Object.entries(data.cloud?.records ?? {}).filter(
    ([, record]) => {
      return record.status === "attempting" || record.status === "uncertain";
    },
  );
  const uncertainReason = uncertain.length
    ? "Uncertain write needs review: " +
      uncertain
        .slice(0, 5)
        .map(([id, record]) => {
          return (
            (record.targetId ??
              data.operations.find((op) => {
                return op.opId === id;
              })?.issueId ??
              "unknown task") +
            " (operation " +
            id +
            ")"
          );
        })
        .join(", ") +
      (uncertain.length > 5 ? "; plus " + (uncertain.length - 5) + " more" : "")
    : "";
  const items: HierarchyPreview["items"] = [];
  const pending = new Set<string>();
  for (const op of data.operations) {
    if (op.type !== "edit" || !Object.hasOwn(op.patch, "parentId")) continue;
    pending.add(op.issueId);
    const remote = data.remote.find((item) => {
      return item.id === op.issueId;
    });
    const blockedReason =
      !remote || !Object.hasOwn(parents, op.issueId)
        ? "Task is missing from the fresh server hierarchy. Nothing can be discarded."
        : uncertainReason
          ? uncertainReason
          : undefined;
    items.push({
      id: op.opId,
      opId: op.opId,
      issueId: op.issueId,
      summary: remote?.summary ?? op.base.summary,
      localParentId: op.patch.parentId ?? null,
      serverParentId: parents[op.issueId] ?? null,
      ...(blockedReason ? { blockedReason } : {}),
    });
  }
  for (const remote of data.remote) {
    if (pending.has(remote.id) || remote.parentId === parents[remote.id])
      continue;
    items.push({
      id: "remote:" + remote.id,
      issueId: remote.id,
      summary: remote.summary,
      localParentId: remote.parentId,
      serverParentId: parents[remote.id] ?? null,
      ...(uncertainReason
        ? {
            blockedReason: uncertainReason,
          }
        : !Object.hasOwn(parents, remote.id)
          ? {
              blockedReason:
                "Task is missing from the fresh server hierarchy. Review before recovery exit.",
            }
          : {}),
    });
  }
  return {
    baseline: JSON.stringify(data),
    ...(uncertainReason ? { blockedReason: uncertainReason } : {}),
    scope: { ...scope },
    serverParents: parents,
    items,
  };
};
export {
  applyHierarchyRecovery,
  exitHierarchyRecovery,
} from "./hierarchy-recovery-apply";
