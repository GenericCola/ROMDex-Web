import { acknowledge, recordDelivery } from "@/cloud/journal";
import { cloudData } from "@/cloud/types";
import { workspaceStore, type WorkspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import type { AttachmentOperation, UploadStore } from "./types";
import { stagedFile } from "./validate";
type Upload = Extract<AttachmentOperation, { type: "attachment" }>;
export const restoreUploadBytes = async (
  operation: Upload,
  file: File,
  workspace: WorkspaceStore = workspaceStore,
  storage: UploadStore = uploadStorage,
) => {
  const epoch = workspace.workspaceEpoch();
  const original = JSON.stringify(operation);
  const current = () => {
    const queued = workspace.getSnapshot().data.operations.find((op) => {
      return op.opId === operation.opId;
    });
    if (
      workspace.workspaceEpoch() !== epoch ||
      JSON.stringify(queued) !== original
    )
      throw Error(
        "The workspace or queued file changed. Open its current file controls.",
      );
  };
  const value = await stagedFile(operation.uploadId, file, operation.file);
  current();
  let reviewed = false;
  await workspace.deliver(
    async (commit) => {
      current();
      await storage.put(value);
      current();
      await commit((data) => {
        const record = cloudData(data).records[operation.opId];
        if (
          record?.localFileState === "missing" &&
          record.status === "conflict"
        ) {
          record.localFileState = "restored";
          record.status = "ready";
          record.message =
            "Original file restored and verified. Save Changes uploads it after a fresh check.";
          reviewed = true;
        }
      });
    },
    new Set([operation.opId]),
  );
  return reviewed;
};

export const cancelLocalUpload = async (
  operation: Upload,
  workspace: WorkspaceStore = workspaceStore,
) => {
  await workspace.deliver(
    async (commit) => {
      await commit((data) => {
        const queued = data.operations.find((op) => {
          return op.opId === operation.opId;
        });
        const record = cloudData(data).records[operation.opId];
        if (
          JSON.stringify(queued) !== JSON.stringify(operation) ||
          !record?.localFileState ||
          !["conflict", "ready"].includes(record.status)
        )
          throw Error("This upload no longer has a local-only recovery block.");
        delete record.localFileState;
        acknowledge(data, operation);
        recordDelivery(data, operation.opId, {
          message:
            "Local upload cancelled before any request. File metadata remains archived.",
        });
      });
    },
    new Set([operation.opId]),
  );
};
