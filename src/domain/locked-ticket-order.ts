import { indexTree, materialize } from "./accepted/core.mjs";
import type { WorkspaceData } from "./types";
// Rank normalization is local bookkeeping, not a move, when every locked
// ticket keeps the same siblings on each side. Index alone misses crossings.
export const preservesLockedOrder = (
  before: WorkspaceData,
  after: WorkspaceData,
  locked: Set<string>,
) => {
  if (JSON.stringify(before.order) === JSON.stringify(after.order)) return true;
  for (const data of [before, after])
    if (
      Object.values(data.order).some((rank) => {
        return !Number.isSafeInteger(rank) || rank < 0;
      })
    )
      return false;
  const prior = indexTree(
    materialize(before.remote, before.operations),
    before.order,
  );
  const next = indexTree(
    materialize(after.remote, after.operations),
    after.order,
  );
  for (const id of locked) {
    const left = prior.byId.get(id),
      right = next.byId.get(id);
    if (!left && !right) {
      if (before.order[id] !== after.order[id]) return false;
      continue;
    }
    if (!left || !right) return false;
    if (left.parentId !== right.parentId) return false;
    const sides = (tree: typeof prior, parent: string | null) => {
      const siblings = (tree.children.get(parent) ?? []).map((item) => {
        return item.id;
      });
      const at = siblings.indexOf(id);
      return JSON.stringify([
        siblings.slice(0, at).sort(),
        siblings.slice(at + 1).sort(),
      ]);
    };
    if (sides(prior, left.parentId) !== sides(next, right.parentId))
      return false;
  }
  return true;
};
