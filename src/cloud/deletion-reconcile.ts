import type { TaskItem, WorkspaceData } from "@/domain/types";
import type { Deletion } from "./deletion-checks";
import { remainingDeletion } from "./deletion-checks";
import { replaceRemote } from "./delivery-helpers";
import { acknowledge, recordDelivery } from "./journal";
import { cloudData, type Commit, type DeliveryPort } from "./types";
// A generic 404 is not proof: it can hide a task after visibility changes.
export const reconcileDeleted = async (
  data: WorkspaceData,
  operation: Deletion,
  commit: Commit,
  port: DeliveryPort,
  acknowledgedMissing = new Set<string>(),
) => {
  const record = cloudData(data).records[operation.opId];
  if (cloudData(data).accountId !== port.accountId)
    throw Error("Deletion belongs to a different account.");
  const absent = new Set<string>();
  for (const id of remainingDeletion(data, operation)) {
    const state = port.deletionState
      ? await port.deletionState(id)
      : { item: await port.get(id), gone: false };
    if (
      !state.item &&
      (state.gone ||
        record?.deleteReceipts?.includes(id) ||
        acknowledgedMissing.has(id))
    )
      absent.add(id);
    else if (acknowledgedMissing.has(id) && state.item)
      throw Error(
        id + " still exists. Nothing was removed from the deletion queue.",
      );
  }
  if (!absent.size) return false;
  const survivors: TaskItem[] = [];
  for (const item of data.remote) {
    if (!item.parentId || !absent.has(item.parentId) || absent.has(item.id))
      continue;
    const fresh = await port.get(item.id);
    if (!fresh || (fresh.parentId && absent.has(fresh.parentId)))
      throw Error(
        "Cannot verify surviving child " +
          item.id +
          ". Its local data was preserved.",
      );
    survivors.push(fresh);
  }
  await commit((next) => {
    const queued = next.operations.find((op) => {
      return op.opId === operation.opId;
    });
    if (JSON.stringify(queued) !== JSON.stringify(operation))
      throw Error("Deletion changed during readback. Read it again.");
    for (const item of survivors) replaceRemote(next, item);
    next.remote = next.remote.filter((item) => {
      return !absent.has(item.id);
    });
    recordDelivery(next, operation.opId, {
      status:
        record &&
        ["attempting", "uncertain", "conflict"].includes(record.status) &&
        !(
          record.targetId &&
          absent.has(record.targetId) &&
          record.status !== "conflict"
        )
          ? record.status
          : "ready",
      deletedIds: [...new Set([...(record?.deletedIds ?? []), ...absent])],
      message: acknowledgedMissing.size
        ? "Already-deleted targets cleared from this browser queue by your confirmation. No deletion request was sent."
        : "Previously completed deletions confirmed without another deletion request.",
    });
    if (!remainingDeletion(next, operation).length)
      acknowledge(next, operation);
  });
  return true;
};
