import type { WorkspaceData } from "@/domain/types";
import { DeletionReviewRequired } from "./deletion-isolation";
import { cloudData } from "./types";
export class DeliveryInputsChanged extends Error {
  constructor() {
    super("New local changes are queued for the next delivery batch.");
  }
}
export const deliveryInputs = (data: WorkspaceData) => {
  return JSON.stringify({
    remote: data.remote,
    operations: data.operations,
    assigned: cloudData(data).assigned,
    shared: cloudData(data).sharedStatuses,
  });
};
export const assertDeliveryInputs = (before: string, data: WorkspaceData) => {
  if (before !== deliveryInputs(data)) throw new DeliveryInputsChanged();
};

export const isDeferredDelivery = (error: unknown): error is Error => {
  return (
    error instanceof DeliveryInputsChanged ||
    error instanceof DeletionReviewRequired
  );
};
