import { indexTree } from "./accepted/core.mjs";
import {
  assertHierarchyScope,
  type HierarchyPreview,
} from "./hierarchy-recovery";
import type { JsonObject } from "./json";
import type { RecoveryScope } from "./order-recovery";
import type { WorkspaceData } from "./types";
export const applyHierarchyRecovery = (
  data: WorkspaceData,
  preview: HierarchyPreview,
  selectedIds: string[],
  scope: RecoveryScope,
) => {
  assertHierarchyScope(data, scope);
  if (
    scope.userId !== preview.scope.userId ||
    scope.projectId !== preview.scope.projectId
  )
    throw Error("Account or project changed. Read the hierarchy again.");
  if (JSON.stringify(data) !== preview.baseline)
    throw Error("Workspace changed since preview. Read the hierarchy again.");
  if (!selectedIds.length || new Set(selectedIds).size !== selectedIds.length)
    throw Error("Select the exact changes to repair.");
  const selected = selectedIds.map((id) => {
    const row = preview.items.find((item) => {
      return item.id === id;
    });
    if (!row || row.blockedReason)
      throw Error(row?.blockedReason ?? "Unknown recovery selection.");
    return row;
  });
  const next = structuredClone(data);
  const issues = new Set(
    selected.map((row) => {
      return row.issueId;
    }),
  );
  const opIds = new Set(
    selected.flatMap((row) => {
      return row.opId ? [row.opId] : [];
    }),
  );
  const backup: JsonObject = JSON.parse(
    JSON.stringify({
      kind: "local-hierarchy-repair",
      scope,
      created: Date.now(),
      message:
        "Selected parent patches cancelled locally; no server mutation was sent.",
      operations: data.operations.filter((op) => {
        return opIds.has(op.opId);
      }),
      records: Object.fromEntries(
        Object.entries(data.cloud?.records ?? {}).filter(([id]) => {
          return opIds.has(id);
        }),
      ),
      parents: data.remote
        .filter((item) => {
          return issues.has(item.id);
        })
        .map((item) => {
          return { issueId: item.id, parentId: item.parentId };
        }),
    }),
  );
  next.operations = next.operations.filter((op) => {
    if (!opIds.has(op.opId)) return true;
    if (op.type !== "edit") throw Error("Recovery operation changed.");
    delete op.patch.parentId;
    if (Object.keys(op.patch).length) return true;
    if (next.cloud) delete next.cloud.records[op.opId];
    return false;
  });
  for (const item of next.remote)
    if (issues.has(item.id))
      item.parentId = preview.serverParents[item.id] ?? null;
  // Reject a partial selection that would leave an invalid local hierarchy.
  const graph = new Map(
    next.remote.map((item) => {
      return [item.id, { ...item }];
    }),
  );
  for (const op of next.operations) {
    if (op.type === "create") graph.set(op.issueId, { ...op.item });
    if (op.type === "delete") for (const id of op.ids) graph.delete(id);
    const item = graph.get(op.issueId);
    if (item && op.type === "edit" && Object.hasOwn(op.patch, "parentId"))
      item.parentId = op.patch.parentId ?? null;
  }
  indexTree([...graph.values()], next.order);
  next.hierarchyRecovery = [...(next.hierarchyRecovery ?? []), backup];
  data.operations = next.operations;
  data.remote = next.remote;
  if (next.cloud) data.cloud = next.cloud;
  data.hierarchyRecovery = next.hierarchyRecovery;
};

export const exitHierarchyRecovery = (
  data: WorkspaceData,
  preview: HierarchyPreview,
  scope: RecoveryScope,
) => {
  assertHierarchyScope(data, scope);
  if (
    scope.userId !== preview.scope.userId ||
    scope.projectId !== preview.scope.projectId ||
    JSON.stringify(data) !== preview.baseline
  )
    throw Error("Workspace or account changed. Preview again before exiting.");
  if (
    preview.items.length ||
    data.operations.some((op) => {
      return op.type === "edit" && Object.hasOwn(op.patch, "parentId");
    }) ||
    Object.values(data.cloud?.records ?? {}).some((record) => {
      return record.status === "attempting" || record.status === "uncertain";
    })
  )
    throw Error(
      preview.blockedReason ??
        "Review remaining hierarchy changes and uncertain deliveries before exiting.",
    );
  data.hierarchyRecovery = [
    ...(data.hierarchyRecovery ?? []),
    {
      kind: "exit-recovery",
      previousAutoSync: data.cloud?.autoSync ?? false,
      created: Date.now(),
    },
  ];
  data.cloud = { ...(data.cloud ?? { records: {} }), autoSync: false };
};
