import type { AttachmentOperation } from "@/attachments/types";
import type { WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
type Upload = Extract<AttachmentOperation, { type: "attachment" }>;
export const uploadReceiptClaimed = (
  data: WorkspaceData,
  operation: Upload,
  id: string,
) => {
  return Object.entries(cloudData(data).records).some(([key, record]) => {
    return (
      key !== operation.opId &&
      record.remoteId === id &&
      (record.targetId === operation.issueId ||
        record.archivedOperation?.issueId === operation.issueId ||
        data.operations.some((op) => {
          return (
            op.opId === key &&
            op.type === "attachment" &&
            op.issueId === operation.issueId
          );
        }))
    );
  });
};

export const uploadCandidateAmbiguous = (
  data: WorkspaceData,
  operation: Upload,
  id: string,
) => {
  const others = [
    ...data.operations,
    ...Object.values(cloudData(data).records).flatMap((record) => {
      return record.status === "confirmed" &&
        !record.remoteId &&
        record.attachmentBeforeIds &&
        record.archivedOperation?.type === "attachment"
        ? [record.archivedOperation]
        : [];
    }),
  ];
  return others.some((other) => {
    if (
      other.type !== "attachment" ||
      other.opId === operation.opId ||
      other.issueId !== operation.issueId
    )
      return false;
    const record = cloudData(data).records[other.opId];
    return (
      record &&
      (["attempting", "uncertain"].includes(record.status) ||
        (record.status === "confirmed" && !record.remoteId)) &&
      !record.attachmentBeforeIds?.includes(id) &&
      other.file.name === operation.file.name &&
      other.file.size === operation.file.size &&
      other.file.hash === operation.file.hash
    );
  });
};
