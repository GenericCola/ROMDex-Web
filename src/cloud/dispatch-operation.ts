import type { UploadStore } from "@/attachments/types";
import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { deliverAttachment } from "./attachment-delivery";
import { deliverCreation } from "./creation";
import { deliverDeletion } from "./deletion";
import { DeletionReviewRequired } from "./deletion-isolation";
import { deliverExisting } from "./existing-delivery";
import { globalDeliveryFailure } from "./global-delivery-failure";
import { DeliveryUncertain } from "./journal";
import { reconcileUploads } from "./reconcile-uploads";
import { OperationReviewRequired } from "./review-isolation";
import { deliverRollup } from "./rollup";
import type { readRollupTree } from "./rollup-tree";
import type { Commit, DeliveryPort } from "./types";
export const dispatchOperation = async (
  operation: TaskOperation,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
  uploads?: UploadStore,
  planned?: Awaited<ReturnType<typeof readRollupTree>>,
) => {
  try {
    if (
      operation.type === "attachment" ||
      operation.type === "attachment-delete"
    )
      await deliverAttachment(operation, commit, port, uploads);
    else if (operation.type === "create")
      await deliverCreation(operation, commit, port);
    else if (operation.type === "delete")
      await deliverDeletion(operation, snapshot, commit, port);
    else if (operation.type === "edit" && operation.purpose === "rollup")
      await deliverRollup(operation, snapshot, commit, port, planned);
    else await deliverExisting(operation, snapshot, commit, port);
  } catch (error) {
    const isolated =
      error instanceof DeliveryUncertain &&
      !globalDeliveryFailure(error) &&
      (operation.type === "attachment" ||
        operation.type === "attachment-delete" ||
        operation.type === "comment" ||
        (operation.type === "edit" &&
          operation.purpose !== "rollup" &&
          !["state", "assignedState", "parentId"].some((key) => {
            return Object.hasOwn(operation.patch, key);
          })));
    if (
      (isolated || error instanceof OperationReviewRequired) &&
      operation.type === "attachment"
    )
      await reconcileUploads(snapshot, commit, port, uploads);
    if (
      !(error instanceof OperationReviewRequired) &&
      !(error instanceof DeletionReviewRequired) &&
      !isolated
    )
      throw error;
  }
};
