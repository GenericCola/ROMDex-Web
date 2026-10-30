import { queueUpload } from "@/attachments/actions";
import { stageFileBatch } from "@/attachments/stage-batch";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
export const stageTaskFiles = (id: string, files: File[]) => {
  return stageFileBatch(files, uploadStorage, async (value) => {
    await workspaceStore.change((data) => {
      queueUpload(data, id, value.id, value.file);
    });
    await workspaceStore.flush();
  });
};
