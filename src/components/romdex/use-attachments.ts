import {
  cancelUnsentUpload,
  queueAttachmentDelete,
  queueUpload,
} from "@/attachments/actions";
import { downloadFile } from "@/attachments/download";
import type { Attachment, AttachmentOperation } from "@/attachments/types";
import { stagedFile } from "@/attachments/validate";
import { requireDelivery } from "@/cloud/session";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { useState } from "react";
import { useAttachmentWork } from "./use-attachment-work";
export const useAttachments = (item: TaskItem) => {
  const work = useAttachmentWork(),
    [removing, setRemoving] = useState<Attachment | null>(null);
  const read = () => {
    work.run(async () => {
      const port = requireDelivery();
      if (!port.files) throw Error("Attachment delivery is unavailable.");
      const files = await port.files.list(item.id);
      await workspaceStore.change((data) => {
        data.attachmentLists ??= {};
        data.attachmentLists[item.id] = files;
      });
      await workspaceStore.flush();
      work.setMessage(
        files.length + " attachments read. No file mutation was sent.",
      );
    });
  };
  const stage = (file: File) => {
    work.run(async () => {
      const id = crypto.randomUUID(),
        value = await stagedFile(id, file);
      await uploadStorage.put(value);
      await workspaceStore.change((data) => {
        queueUpload(data, item.id, id, value.file);
      });
      await workspaceStore.flush();
      work.setMessage(
        "File staged in this browser. Save Changes sends it when delivery is connected.",
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
      const port = requireDelivery();
      if (!port.files) throw Error("Attachment delivery is unavailable.");
      downloadFile(await port.files.download(item.id, file), file.name);
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
  return {
    ...work,
    cancel,
    removing,
    setRemoving,
    read,
    stage,
    restore,
    exportPending,
    download,
    remove,
  };
};
