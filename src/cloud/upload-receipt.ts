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
