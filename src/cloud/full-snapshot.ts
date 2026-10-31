import { indexTree } from "@/domain/accepted/core.mjs";
import { validateTask } from "@/domain/validate-task";
import type { DeliveryPort } from "./types";
export const readFullSnapshot = async (port: DeliveryPort) => {
  const items = await port.all();
  const ids = new Set<string>();
  for (const item of items) {
    validateTask(item);
    if (
      !/^PMON-\d+$/.test(item.id) ||
      item.updated === null ||
      !Number.isSafeInteger(item.updated) ||
      item.updated < 0 ||
      ids.has(item.id)
    )
      throw Error("Invalid or duplicate tasks in the full YouTrack snapshot.");
    ids.add(item.id);
  }
  indexTree(items);
  return items;
};
