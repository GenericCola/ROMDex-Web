import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { planReceipt } from "@/rdx/plan-ledger";
import { replaceRemote } from "./delivery-helpers";
import type { Commit, DeliveryRecord } from "./types";
import { cloudData } from "./types";
export class DeliveryUncertain extends Error {}
export const recordDelivery = (
  data: WorkspaceData,
  id: string,
  patch: Partial<DeliveryRecord>,
) => {
  const previous = cloudData(data);
  const record: DeliveryRecord = {
    status: "attempting",
    message: "Request may have reached YouTrack.",
    ...previous.records[id],
    ...patch,
  };
  data.cloud = { ...previous, records: { ...previous.records, [id]: record } };
};
export const acknowledge = (
  data: WorkspaceData,
  operation: TaskOperation,
  remote?: TaskItem,
) => {
  if (remote) replaceRemote(data, remote);
  data.operations = data.operations.filter((op) => {
    return op.opId !== operation.opId;
  });
  recordDelivery(data, operation.opId, {
    status: "confirmed",
    message: "YouTrack result confirmed.",
    archivedOperation: operation,
  });
  planReceipt(data, operation.opId);
};
export const attemptDelivery = async (
  operation: TaskOperation,
  commit: Commit,
  action: () => Promise<void>,
  targetId = operation.issueId,
  prepare?: (data: WorkspaceData) => void,
) => {
  // Save the marker before every mutation; a crash requires readback and explicit review.
  await commit((data) => {
    prepare?.(data);
    recordDelivery(data, operation.opId, {
      status: "attempting",
      targetId,
      message: "Request may have reached YouTrack.",
    });
  });
  try {
    await action();
  } catch (error) {
    await commit((data) => {
      recordDelivery(data, operation.opId, {
        status: "uncertain",
        message:
          "Delivery or confirmation was interrupted. Do not resend without review.",
      });
    });
    throw new DeliveryUncertain(
      "The delivery result is uncertain. Your queued change is preserved for review.",
      { cause: error },
    );
  }
};
