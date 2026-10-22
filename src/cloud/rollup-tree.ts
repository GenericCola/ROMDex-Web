import { indexTree, STATES } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { observeStatus } from "./assigned-status";
import type { DeliveryPort } from "./types";
export const readRollupTree = async (
  data: WorkspaceData,
  port: DeliveryPort,
) => {
  const raw = await port.all();
  const ids = new Set(
    raw.map((item) => {
      return item.id;
    }),
  );
  if (ids.size !== raw.length)
    throw Error("Duplicate tasks block status rollups.");
  if (
    data.remote.some((item) => {
      return !ids.has(item.id);
    })
  )
    throw Error(
      "A known task is missing or unreadable. Refresh before status rollups.",
    );
  for (const item of raw) {
    validateTask(item);
    if (item.updated === null)
      throw Error("A status rollup needs readable revision timestamps.");
    if (
      !/^PMON-\d+$/.test(item.id) ||
      (item.parentId && !ids.has(item.parentId))
    )
      throw Error("An incomplete or external hierarchy blocks status rollups.");
  }
  const items = raw.map((item) => {
    return observeStatus(data, item);
  });
  const tree = indexTree(items);
  const deepest = [...items].sort((a, b) => {
    return (tree.depths.get(b.id) ?? 0) - (tree.depths.get(a.id) ?? 0);
  });
  const desired = (item: TaskItem) => {
    const color = tree.colors.get(item.id);
    if (!color) throw Error("A task has no calculated status.");
    return tree.children.get(item.id)?.length
      ? STATES[color]
      : (item.assignedState ?? item.state);
  };
  const next = deepest.find((item) => {
    return item.state !== desired(item);
  });
  // Only this subtree contributes to the next write; verify its leaves as well as its parents.
  const pending = next ? [next] : [];
  while (pending.length) {
    const item = pending.pop();
    if (!item) break;
    const known = tree.children.get(item.id) ?? [];
    pending.push(...known);
    const children = await port.children(item.id);
    const expected = new Set(
      known.map((child) => {
        return child.id;
      }),
    );
    if (
      children.length !== expected.size ||
      children.some((id) => {
        return !expected.has(id);
      })
    )
      throw Error(
        "The hierarchy changed or has unreadable children. Refresh before status rollups.",
      );
  }
  return { items, desired, next };
};
