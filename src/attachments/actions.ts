import { acknowledge, recordDelivery } from "@/cloud/journal";
import { cloudData } from "@/cloud/types";
import { materialize } from "@/domain/accepted/core.mjs";
import { reviewedTicketIds } from "@/domain/ticket-locks";
import type { WorkspaceData } from "@/domain/types";
import type { Attachment, UploadFile } from "./types";
import { validateAttachment, validateUploadFile } from "./validate";
const ready = (data: WorkspaceData, issue: string) => {
  if (
    !materialize(data.remote, data.operations).some((item) => {
      return item.id === issue;
    })
  )
    throw Error("The task no longer exists.");
  const locked = reviewedTicketIds(data);
  if (locked.has("*") || locked.has(issue))
    throw Error("Review this ticket before changing its attachments.");
};
export const queueUpload = (
  data: WorkspaceData,
  issueId: string,
  id: string,
  file: UploadFile,
) => {
  ready(data, issueId);
  validateUploadFile(file);
  if (
    data.operations.some((operation) => {
      return operation.opId === id;
    })
  )
    throw Error("This upload is already queued.");
  data.operations.push({
    opId: id,
    type: "attachment",
    issueId,
    uploadId: id,
    file,
  });
};
export const queueAttachmentDelete = (
  data: WorkspaceData,
  issueId: string,
  file: Attachment,
) => {
  ready(data, issueId);
  validateAttachment(file);
  if (!/^PMON-\d+$/.test(issueId))
    throw Error("Only a delivered task has cloud attachments.");
  if (
    data.operations.some((op) => {
      return (
        op.type === "attachment-delete" &&
        op.issueId === issueId &&
        op.attachmentId === file.id
      );
    })
  )
    throw Error("This attachment deletion is already queued.");
  data.operations.push({
    opId: crypto.randomUUID(),
    type: "attachment-delete",
    issueId,
    attachmentId: file.id,
    base: structuredClone(file),
  });
};
export const validateAttachmentLists = (data: WorkspaceData) => {
  if (data.attachmentLists === undefined) return;
  if (
    !data.attachmentLists ||
    typeof data.attachmentLists !== "object" ||
    Array.isArray(data.attachmentLists)
  )
    throw Error("Invalid cached attachment lists.");
  for (const [id, files] of Object.entries(data.attachmentLists)) {
    if (!/^PMON-\d+$/.test(id) || !Array.isArray(files) || files.length > 1000)
      throw Error("Invalid cached attachment inventory.");
    const seen = new Set<string>();
    for (const file of files) {
      validateAttachment(file);
      if (seen.has(file.id))
        throw Error("Duplicate cached attachment identity.");
      seen.add(file.id);
    }
  }
};

export const cancelUnsentUpload = (data: WorkspaceData, id: string) => {
  const operation = data.operations.find((op) => {
    return op.opId === id;
  });
  if (operation?.type !== "attachment")
    throw Error("Upload is no longer pending.");
  ready(data, operation.issueId);
  if (cloudData(data).records[id])
    throw Error(
      "This file request has delivery evidence. Use delivery review instead of cancelling it.",
    );
  acknowledge(data, operation);
  recordDelivery(data, id, {
    message:
      "Unsent upload explicitly cancelled; its request metadata is retained. No cloud request was sent.",
  });
};
