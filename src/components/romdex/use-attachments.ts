import {
  cancelUnsentUpload,
  queueAttachmentDelete,
} from "@/attachments/actions";
import { cancelUnsentAttachmentDeletion } from "@/attachments/cancel-deletion";
import { downloadFile } from "@/attachments/download";
import type { Attachment, AttachmentOperation } from "@/attachments/types";
import { stagedFile } from "@/attachments/validate";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { attachmentReader } from "@/youtrack/attachment-reader";
import { useState } from "react";
import { stageTaskFiles } from "./stage-task-files";
import { useAttachmentInventory } from "./use-attachment-inventory";
import { useAttachmentPreview } from "./use-attachment-preview";
import { useAttachmentWork } from "./use-attachment-work";
export const useAttachments = (item: TaskItem, quietRead = false) => {
  const work = useAttachmentWork(),
    [removing, setRemoving] = useState<Attachment | null>(null);
  const preview = useAttachmentPreview(item.id, work);
  const inventory = useAttachmentInventory(item, work, quietRead);
  const stageMany = (files: File[]) => {
    work.run(async () => {
      const staged = await stageTaskFiles(item.id, files);
      work.setMessage(
        staged.length +
          " files kept locally. Save Changes uploads them when delivery is connected.",
      );
    });
  };
  const restore = (
    operation: Extract<AttachmentOperation, { type: "attachment" }>,
    file: File,
  ) => {
    work.run(async () => {
      const value = await stagedFile(operation.uploadId, file, operation.file);
      await uploadStorage.put(value);
      work.setMessage(
        "Queued file bytes restored and verified. Delivery review requirements are unchanged.",
      );
    });
  };
  const exportPending = (id: string) => {
    work.run(async () => {
      const value = await uploadStorage.get(id);
      if (!value)
        throw Error(
          "Queued file bytes are missing. Restore the original file.",
        );
      downloadFile(value.blob, value.file.name);
      work.setMessage("Staged bytes exported. No cloud request was made.");
    });
  };
  const download = (file: Attachment) => {
    work.run(async () => {
      downloadFile(await attachmentReader().download(item.id, file), file.name);
      work.setMessage("Attachment downloaded from verified current metadata.");
    });
  };
  const remove = () => {
    const target = removing;
    if (!target) return;
    work.run(async () => {
      await workspaceStore.change((data) => {
        queueAttachmentDelete(data, item.id, target);
      });
      await workspaceStore.flush();
      setRemoving(null);
      work.setMessage(
        "Attachment deletion queued. Connected Save Changes sends the reviewed request.",
      );
    });
  };
  const cancel = (id: string) => {
    work.run(async () => {
      await workspaceStore.change((data) => {
        cancelUnsentUpload(data, id);
      });
      await workspaceStore.flush();
      await uploadStorage.remove(id);
      work.setMessage(
        "Upload cancelled in this browser; the original file was not changed.",
      );
    });
  };
  const cancelDeletion = (id: string) => {
    work.run(async () => {
      await workspaceStore.change((data) => {
        cancelUnsentAttachmentDeletion(data, id);
      });
      await workspaceStore.flush();
      work.setMessage(
        "Unsent attachment deletion cancelled. The remote file was not changed.",
      );
    });
  };
  return {
    ...inventory,
    cancelDeletion,
    ...work,
    ...preview,
    cancel,
    removing,
    setRemoving,
    stageMany,
    restore,
    exportPending,
    download,
    remove,
  };
};
