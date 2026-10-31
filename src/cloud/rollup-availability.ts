import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { YouTrackHttpError } from "@/youtrack/http-error";
import { availabilityTree } from "./rollup-availability-tree";
import { cloudData, type DeliveryPort } from "./types";
export const readRollupAvailability = async (
  data: WorkspaceData,
  port: DeliveryPort,
) => {
  if (cloudData(data).accountId && cloudData(data).accountId !== port.accountId)
    throw Error("The task read belongs to a different account.");
  const raw = await port.all();
  const fresh = new Map<string, TaskItem>();
  const accept = (item: TaskItem) => {
    validateTask(item);
    if (
      !/^PMON-\d+$/.test(item.id) ||
      item.updated === null ||
      !Number.isSafeInteger(item.updated) ||
      item.updated < 0
    )
      throw Error("The task read returned an invalid task or revision.");
    fresh.set(item.id, item);
  };
  for (const item of raw) {
    if (fresh.has(item.id))
      throw Error("Duplicate tasks block status updates.");
    accept(item);
  }
  const previous = new Map(
    [...(cloudData(data).unavailable?.tasks ?? []), ...data.remote].map(
      (item) => {
        return [item.id, item];
      },
    ),
  );
  const missing = new Set<string>();
  const gone = new Set<string>();
  const denied = new Set<string>();
  const inspect = async (id: string) => {
    if (!/^PMON-\d+$/.test(id)) {
      missing.add(id);
      return;
    }
    try {
      const state = port.deletionState
        ? await port.deletionState(id)
        : { item: await port.get(id), gone: false };
      if (state.item) {
        if (state.item.id !== id)
          throw Error("The task read returned a different task.");
        accept(state.item);
        return;
      }
      const receipt = Object.values(cloudData(data).records).some((record) => {
        return (
          (record.deletedIds ?? []).includes(id) ||
          (record.deleteReceipts ?? []).includes(id)
        );
      });
      if (state.gone || receipt) gone.add(id);
      else missing.add(id);
    } catch (error) {
      if (!(error instanceof YouTrackHttpError) || error.status !== 403)
        throw error;
      denied.add(id);
      missing.add(id);
    }
  };
  for (const id of previous.keys()) if (!fresh.has(id)) await inspect(id);
  const inspected = new Set([...previous.keys(), ...missing]);
  let parentsPending = true;
  while (parentsPending) {
    parentsPending = false;
    for (const item of [...fresh.values()]) {
      if (
        !item.parentId ||
        fresh.has(item.parentId) ||
        inspected.has(item.parentId)
      )
        continue;
      inspected.add(item.parentId);
      await inspect(item.parentId);
      parentsPending = true;
    }
  }
  return availabilityTree(data, previous, fresh, missing, gone, denied);
};
