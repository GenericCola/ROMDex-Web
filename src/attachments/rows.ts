import { cloudData } from "@/cloud/types";
import type { WorkspaceData } from "@/domain/types";
export const fileSize = (bytes: number) => {
  return bytes < 1024
    ? bytes + " B"
    : bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + " KB"
      : (bytes / 1024 / 1024).toFixed(1) + " MB";
};
export const nativeAttachmentRows = (data: WorkspaceData, issueId: string) => {
  const deletions = data.operations.filter((op) => {
    return op.type === "attachment-delete" && op.issueId === issueId;
  });
  const files = new Map(
    (data.attachmentLists?.[issueId] ?? []).map((file) => {
      return [file.id, file];
    }),
  );
  for (const op of deletions)
    if (op.type === "attachment-delete" && !files.has(op.attachmentId))
      files.set(op.attachmentId, op.base);
  return [...files.values()].map((file) => {
    const deletion = deletions.find((op) => {
      return op.type === "attachment-delete" && op.attachmentId === file.id;
    });
    const held = !!(deletion && cloudData(data).records[deletion.opId]);
    return {
      file,
      deletion,
      held,
      status: deletion
        ? held
          ? "Deletion Needs Review"
          : "Queued for Deletion"
        : "On YouTrack",
    };
  });
};
