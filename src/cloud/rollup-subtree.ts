import type { TaskItem } from "@/domain/types";
import { YouTrackHttpError } from "@/youtrack/http-error";
import type { DeliveryPort } from "./types";
export const readableRollupSubtree = async (
  root: TaskItem,
  items: TaskItem[],
  port: DeliveryPort,
  blocked: Set<string>,
  missing: string[],
) => {
  const pending = [root];
  while (pending.length) {
    const item = pending.pop()!;
    const known = items.filter((entry) => {
      return entry.parentId === item.id;
    });
    pending.push(...known);
    let children: string[];
    try {
      children = await port.children(item.id);
    } catch (error) {
      if (!(error instanceof YouTrackHttpError) || error.status !== 403)
        throw error;
      children = ["unreadable"];
    }
    const expected = new Set(
      known.map((entry) => {
        return entry.id;
      }),
    );
    if (
      children.length === expected.size &&
      children.every((id) => {
        return expected.has(id);
      })
    )
      continue;
    for (const id of children)
      if (/^PMON-\d+$/.test(id) && !expected.has(id) && !missing.includes(id))
        missing.push(id);
    if (!missing.length) missing.push(item.id);
    let current: TaskItem | undefined = item;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      blocked.add(current.id);
      const { parentId }: { parentId: string | null } = current;
      current = items.find((entry) => {
        return entry.id === parentId;
      });
    }
    return false;
  }
  return true;
};
