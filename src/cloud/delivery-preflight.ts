import type { WorkspaceData } from "@/domain/types";
import { reconcileDeleted } from "./deletion-reconcile";
import { cloudData, type Commit, type DeliveryPort } from "./types";
export const deliveryPreflight = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  const binding = cloudData(snapshot()).accountId;
  if (binding && binding !== port.accountId)
    throw Error("This browser queue belongs to a different YouTrack account.");
  await reconcileDeletionRecords(snapshot, commit, port);
  if (cloudData(snapshot()).unavailable)
    await commit((data) => {
      data.cloud = { ...cloudData(data), rollupPending: true };
    });
};

export const reconcileDeletionRecords = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  for (const op of snapshot().operations) {
    if (op.type === "delete" && cloudData(snapshot()).records[op.opId])
      await reconcileDeleted(snapshot(), op, commit, port);
  }
};
