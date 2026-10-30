import type {
  AttachmentOperation,
  AttachmentPort,
  UploadStore,
} from "@/attachments/types";
import {
  requireCloudUploadSize,
  sameAttachment,
  sameUploadFile,
  uploadId,
} from "@/attachments/validate";
import { sha256 } from "@/domain/json";
import { uploadStorage } from "@/storage/upload-storage";
import { observeStatus } from "./assigned-status";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
export const verifiedAttachment = async (
  operation: Extract<AttachmentOperation, { type: "attachment" }>,
  files: AttachmentPort,
  account: string,
  id: string,
  before: string[],
) => {
  if (!uploadId(id) || before.includes(id))
    throw Error("Choose an exact new attachment receipt.");
  const inventory = await files.list(operation.issueId),
    file = inventory.find((value) => {
      return value.id === id;
    });
  if (
    file?.name !== operation.file.name ||
    file.size !== operation.file.size ||
    file.authorId !== account
  )
    throw Error("The exact attachment does not match this upload or account.");
  if (
    (await sha256(await files.download(operation.issueId, file))) !==
    operation.file.hash
  )
    throw Error("The attachment bytes do not match the queued file.");
  return inventory;
};
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
  if (!task)
    throw Error(
      "The attachment's task is not readable. No file request was sent.",
    );
  const before = await files.list(operation.issueId);
  if (operation.type === "attachment-delete") {
    const current = before.find((file) => {
      return file.id === operation.attachmentId;
    });
    if (!current || !sameAttachment(current, operation.base)) {
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          message:
            "The attachment changed or is no longer readable. Review before deleting it.",
        });
      });
      throw Error("Review the changed attachment. No deletion was sent.");
    }
  } else {
    requireCloudUploadSize(operation.file.size);
    files.requireUploadSize?.(operation.file.size);
    const value = await storage.get(operation.uploadId);
    if (!value || !sameUploadFile(value.file, operation.file))
      throw Error("Restore the queued file bytes before delivery.");
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
