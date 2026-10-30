import { indexTree, materialize } from "./accepted/core.mjs";
import type { WorkspaceData } from "./types";
import { validateWorkspace } from "./workspace-data";
export interface RecoveryScope {
  userId: string;
  projectId: string;
}
interface OrderTask {
  id: string;
  parentId: string | null;
}
export interface OrderPreview {
  scope: RecoveryScope;
  baseline: string;
  order: Record<string, number>;
  count: number;
}
const scopeMatches = (actual: unknown, expected: RecoveryScope) => {
  const scope = actual as RecoveryScope | undefined;
  if (
    !expected.userId ||
    !expected.projectId ||
    scope?.userId !== expected.userId ||
    scope.projectId !== expected.projectId
  )
    throw Error(
      "Account or project does not match. Export a fresh recovery copy from the correct device while signed into this same account and project.",
    );
};
const tasks = (data: WorkspaceData): OrderTask[] => {
  return materialize(data.remote, data.operations).map(({ id, parentId }) => {
    return {
      id,
      parentId,
    };
  });
};
export const orderBackup = (data: WorkspaceData, scope: RecoveryScope) => {
  return JSON.stringify(
    {
      format: "ROMDexOrderBackup/1",
      recoveryScope: scope,
      exportedAt: new Date().toISOString(),
      tasks: tasks(data),
      order: data.order,
    },
    null,
    2,
  );
};
export const previewOrderRecovery = (
  text: string,
  current: WorkspaceData,
  scope: RecoveryScope,
): OrderPreview => {
  if (text.length > 128 * 1024 * 1024)
    throw Error("Recovery file exceeds 128 MiB.");
  const root = JSON.parse(text) as Record<string, unknown>;
  if (!root || typeof root !== "object") throw Error("Invalid recovery file.");
  scopeMatches(root.recoveryScope, scope);
  let sourceTasks: OrderTask[], sourceOrder: Record<string, number>;
  if (root.format === "ROMDexWebRecovery/1") {
    const source = validateWorkspace(root.data);
    if (source.cloud?.accountId && source.cloud.accountId !== scope.userId)
      throw Error("Recovery queue account does not match.");
    sourceTasks = tasks(source);
    sourceOrder = source.order;
  } else if (root.format === "ROMDexOrderBackup/1") {
    sourceTasks = root.tasks as OrderTask[];
    sourceOrder = root.order as Record<string, number>;
  } else throw Error("Choose a ROMDex recovery copy or order backup.");
  const currentTasks = tasks(current),
    currentIds = new Set(
      currentTasks.map((item) => {
        return item.id;
      }),
    );
  if (
    !Array.isArray(sourceTasks) ||
    sourceTasks.length !== currentTasks.length ||
    new Set(
      sourceTasks.map((item) => {
        return item?.id;
      }),
    ).size !== currentIds.size ||
    sourceTasks.some((item) => {
      return !item || !currentIds.has(item.id);
    })
  )
    throw Error(
      "Task IDs differ between devices. No tasks were dropped or added; resolve the mismatch before restoring order.",
    );
  const parents = new Map(
    currentTasks.map((item) => {
      return [item.id, item.parentId];
    }),
  );
  if (
    sourceTasks.some((item) => {
      return item.parentId !== parents.get(item.id);
    })
  )
    throw Error(
      "Task hierarchy differs between devices. This tool restores order only; repair parent relationships separately first.",
    );
  if (
    !sourceOrder ||
    typeof sourceOrder !== "object" ||
    Array.isArray(sourceOrder) ||
    Object.entries(sourceOrder).some(([id, rank]) => {
      return !currentIds.has(id) || !Number.isSafeInteger(rank) || rank < 0;
    })
  )
    throw Error(
      "Order contains unknown IDs or invalid ranks. Nothing was changed.",
    );
  // Derive a complete sibling permutation from the source's actual task set,
  // including its normal ID tie-break for tasks without explicit local ranks.
  const tree = indexTree(
    materialize(current.remote, current.operations),
    sourceOrder,
  );
  const order: Record<string, number> = {};
  for (const siblings of tree.children.values())
    siblings.forEach((item, rank) => {
      order[item.id] = rank;
    });
  if (Object.keys(order).length !== currentIds.size)
    throw Error("Order is not a complete task permutation.");
  return {
    scope: { ...scope },
    baseline: JSON.stringify(current),
    order,
    count: currentIds.size,
  };
};
export const applyOrderRecovery = (
  data: WorkspaceData,
  preview: OrderPreview,
  scope: RecoveryScope,
) => {
  scopeMatches(preview.scope, scope);
  if (JSON.stringify(data) !== preview.baseline)
    throw Error(
      "Workspace changed since preview. Preview the file again before applying.",
    );
  data.order = structuredClone(preview.order);
};
