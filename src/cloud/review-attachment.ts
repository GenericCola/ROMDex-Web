import type { AttachmentOperation, UploadStore } from "@/attachments/types";
import type { WorkspaceData } from "@/domain/types";
import { uploadStorage } from "@/storage/upload-storage";
import { observeStatus } from "./assigned-status";
import { acknowledge, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
import { verifiedAttachment } from "./verified-attachment";
export const reviewAttachment = async (
  data: WorkspaceData,
  operation: AttachmentOperation,
  choice: "cloud" | "local" | "confirm",
  commit: Commit,
  port: DeliveryPort,
  receipt: string,
  missing: boolean,
  storage: UploadStore = uploadStorage,
) => {
  if (choice === "local")
    throw Error(
      "File requests cannot be rebased or resent. Keep YouTrack, then stage a newly reviewed operation if needed.",
    );
  if (choice === "cloud") {
    await commit((next) => {
      const localOnly =
        !!cloudData(next).records[operation.opId]?.localFileState;
      delete cloudData(next).records[operation.opId]?.localFileState;
      acknowledge(next, operation);
      recordDelivery(next, operation.opId, {
        message: localOnly
          ? "Local upload cancelled before any request. File metadata remains archived."
          : "File request explicitly stopped. A cloud file or deletion may already exist; its evidence remains archived.",
      });
    });
    return;
  }
  if (!port.files)
    throw Error("Reconnect attachment delivery before reviewing.");
  const current = await port.get(operation.issueId);
  if (!current)
    throw Error(
      "The task is unreadable. Preserve recovery and resolve access first.",
    );
  const record = cloudData(data).records[operation.opId];
  let inventory;
  if (operation.type === "attachment") {
    if (!Array.isArray(record?.attachmentBeforeIds))
      throw Error("Upload baseline evidence is missing. Do not resend.");
    inventory = await verifiedAttachment(
      operation,
      port.files,
      port.accountId,
      record.remoteId ?? receipt,
      record.attachmentBeforeIds,
    );
  } else {
    if (!missing)
      throw Error(
        "Acknowledge that you checked the exact attachment and its access before confirming absence.",
      );
    inventory = await port.files.list(operation.issueId);
    if (
      inventory.some((file) => {
        return file.id === operation.attachmentId;
      })
    )
      throw Error(
        "The attachment is still present. The deletion was not resent.",
      );
  }
  await commit((next) => {
    next.attachmentLists ??= {};
    next.attachmentLists[operation.issueId] = inventory;
    acknowledge(next, operation, observeStatus(next, current));
    recordDelivery(next, operation.opId, {
      message:
        operation.type === "attachment"
          ? "Exact attachment ID and bytes confirmed without resending."
          : "Attachment absence explicitly reviewed; deletion was not resent.",
    });
  });
  if (operation.type === "attachment")
    await storage.remove(operation.uploadId).catch(() => {
      return undefined;
    });
};
