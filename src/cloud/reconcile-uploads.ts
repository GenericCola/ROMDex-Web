import type { UploadStore } from "@/attachments/types";
import type { WorkspaceData } from "@/domain/types";
import { uploadStorage } from "@/storage/upload-storage";
import { observeStatus } from "./assigned-status";
import { globalDeliveryFailure } from "./global-delivery-failure";
import { acknowledge, recordDelivery } from "./journal";
import { cloudData, type Commit, type DeliveryPort } from "./types";
import {
  uploadCandidateAmbiguous,
  uploadReceiptClaimed,
} from "./upload-receipt";
import { verifiedAttachment } from "./verified-attachment";

const checks = new WeakMap<DeliveryPort, Map<string, number>>();
export const uploadReadbackDue = (
  data: WorkspaceData,
  port: DeliveryPort,
  now = Date.now(),
) => {
  return (
    !!port.files &&
    cloudData(data).accountId === port.accountId &&
    data.operations.some((op) => {
      const record = cloudData(data).records[op.opId];
      const last = checks.get(port)?.get(op.opId);
      return (
        op.type === "attachment" &&
        !!record?.attachmentBeforeIds &&
        ["attempting", "uncertain"].includes(record.status) &&
        (last === undefined || now - last >= 60_000)
      );
    })
  );
};
export const reconcileUploads = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
  storage: UploadStore = uploadStorage,
  now = Date.now(),
) => {
  if (!port.files || cloudData(snapshot()).accountId !== port.accountId) return;
  let attempts = checks.get(port);
  if (!attempts) {
    attempts = new Map();
    checks.set(port, attempts);
  }
  for (const operation of snapshot().operations) {
    const record = cloudData(snapshot()).records[operation.opId];
    if (
      operation.type !== "attachment" ||
      !record ||
      !["attempting", "uncertain"].includes(record.status) ||
      !record.attachmentBeforeIds
    )
      continue;
    const last = attempts.get(operation.opId);
    if (last !== undefined && now - last < 60_000) continue;
    attempts.set(operation.opId, now);
    let receipt = record.remoteId;
    let inventory, current;
    try {
      if (!receipt) {
        const candidates = (await port.files.list(operation.issueId)).filter(
          (file) => {
            return (
              !record.attachmentBeforeIds?.includes(file.id) &&
              file.name === operation.file.name &&
              file.size === operation.file.size &&
              file.authorId === port.accountId
            );
          },
        );
        if (candidates.length !== 1) continue;
        receipt = candidates[0]?.id;
        if (
          !receipt ||
          uploadCandidateAmbiguous(snapshot(), operation, receipt)
        )
          continue;
      }
      if (uploadReceiptClaimed(snapshot(), operation, receipt)) continue;
      inventory = await verifiedAttachment(
        operation,
        port.files,
        port.accountId,
        receipt,
        record.attachmentBeforeIds,
      );
      current = await port.get(operation.issueId);
      if (!current) continue;
    } catch (error) {
      if (globalDeliveryFailure(error)) throw error;
      // Read failures retain the original evidence; never infer absence or resend.
      continue;
    }
    const remoteId = receipt;
    await commit((data) => {
      if (
        cloudData(data).accountId !== port.accountId ||
        uploadReceiptClaimed(data, operation, remoteId) ||
        !data.operations.some((op) => {
          return JSON.stringify(op) === JSON.stringify(operation);
        })
      )
        throw Error(
          "Upload review context changed. The queued evidence is preserved.",
        );
      data.attachmentLists ??= {};
      data.attachmentLists[operation.issueId] = inventory;
      recordDelivery(data, operation.opId, { remoteId });
      acknowledge(data, operation, observeStatus(data, current));
      recordDelivery(data, operation.opId, {
        message:
          "Exact attachment ID and bytes confirmed automatically without resending.",
      });
    });
    await storage.remove(operation.uploadId).catch(() => {
      return undefined;
    });
  }
};
