import type { WorkspaceData } from "@/domain/types";
export const knownAttachmentCount = (data: WorkspaceData, id: string) => {
  return (
    (data.attachmentLists?.[id]?.length ?? 0) +
    data.operations.filter((op) => {
      return op.type === "attachment" && op.issueId === id;
    }).length
  );
};
