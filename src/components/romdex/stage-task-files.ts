import { queueUpload } from "@/attachments/actions";
import { stageFileBatch } from "@/attachments/stage-batch";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import {
  attachmentReader,
  attachmentsReadable,
} from "@/youtrack/attachment-reader";
export const stageTaskFiles = (id: string, files: File[]) => {
  if (attachmentsReadable()) {
    const reader = attachmentReader();
    for (const file of files) reader.requireUploadSize?.(file.size);
  }
  return stageFileBatch(files, uploadStorage, async (value) => {
    await workspaceStore.change((data) => {
      queueUpload(data, id, value.id, value.file);
    });
    await workspaceStore.flush();
  });
};
