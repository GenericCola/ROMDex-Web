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
  const blocked = Object.entries(cloudData(snapshot()).records).find(
    ([id, record]) => {
      return (
        ["attempting", "uncertain", "conflict"].includes(record.status) &&
        snapshot().operations.find((op) => {
          return op.opId === id;
        })?.type !== "delete"
      );
    },
  );
  if (blocked)
    throw Error(
      "Review the conflicting or uncertain operation before continuing.",
    );
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
