import type { AttachmentOperation, UploadStore } from "@/attachments/types";
import {
  requireCloudUploadSize,
  sameAttachment,
  sameUploadFile,
} from "@/attachments/validate";
import { uploadStorage } from "@/storage/upload-storage";
import { observeStatus } from "./assigned-status";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import { OperationReviewRequired } from "./review-isolation";
import { cloudData, type Commit, type DeliveryPort } from "./types";
import { verifiedAttachment } from "./verified-attachment";
export const deliverAttachment = async (
  operation: AttachmentOperation,
  commit: Commit,
  port: DeliveryPort,
  storage: UploadStore = uploadStorage,
) => {
  if (!port.files || !/^PMON-\d+$/.test(operation.issueId))
    throw Error(
      "Reconnect file delivery after the task has a verified PMON ID.",
    );
  const { files } = port,
    task = await port.get(operation.issueId);
  if (!task) {
    const message =
      operation.issueId +
      " is not readable. The queued file change is preserved; no file request was sent.";
    await commit((data) => {
      delete cloudData(data).records[operation.opId]?.localFileState;
      recordDelivery(data, operation.opId, { status: "conflict", message });
    });
    throw new OperationReviewRequired(message);
  }
  const before = await files.list(operation.issueId);
  if (operation.type === "attachment-delete") {
    const current = before.find((file) => {
      return file.id === operation.attachmentId;
    });
    if (!current || !sameAttachment(current, operation.base)) {
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          message: "Review the changed attachment. No deletion was sent.",
        });
      });
      throw new OperationReviewRequired(
        "Review the changed attachment. No deletion was sent.",
      );
    }
  } else {
    requireCloudUploadSize(operation.file.size);
    files.requireUploadSize?.(operation.file.size);
    const value = await storage.get(operation.uploadId);
    if (!value || !sameUploadFile(value.file, operation.file)) {
      const message =
        "Restore the original file for " +
        operation.file.name +
        ". No upload was sent; other tickets can sync.";
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          localFileState: "missing",
          message,
        });
      });
      throw new OperationReviewRequired(message);
    }
  }
  await attemptDelivery(
    operation,
    commit,
    async () => {
      let inventory;
      if (operation.type === "attachment") {
        const value = await storage.get(operation.uploadId);
        if (!value || !sameUploadFile(value.file, operation.file))
          throw Error("Queued file bytes or metadata changed after preflight.");
        const receipt = await files.upload(operation.issueId, value);
        await commit((data) => {
          recordDelivery(data, operation.opId, { remoteId: receipt.id });
        });
        inventory = await verifiedAttachment(
          operation,
          files,
          port.accountId,
          receipt.id,
          before.map((file) => {
            return file.id;
          }),
        );
      } else {
        await files.remove(operation.issueId, operation.attachmentId);
        inventory = await files.list(operation.issueId);
        if (
          inventory.some((file) => {
            return file.id === operation.attachmentId;
          })
        )
          throw Error("The deleted attachment is still present.");
      }
      const current = await port.get(operation.issueId);
      if (!current)
        throw Error("The task cannot be verified after the file request.");
      await commit((data) => {
        data.attachmentLists ??= {};
        data.attachmentLists[operation.issueId] = inventory;
        acknowledge(data, operation, observeStatus(data, current));
      });
    },
    operation.issueId,
    (data) => {
      delete cloudData(data).records[operation.opId]?.localFileState;
      recordDelivery(data, operation.opId, {
        attachmentBeforeIds: before.map((file) => {
          return file.id;
        }),
      });
    },
  );
  if (operation.type === "attachment")
    await storage.remove(operation.uploadId).catch(() => {
      return undefined;
    });
};
