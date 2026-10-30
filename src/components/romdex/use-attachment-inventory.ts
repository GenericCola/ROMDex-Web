import type { Attachment } from "@/attachments/types";
import { authRequestGuard, authToken } from "@/auth/session";
import { previewRequired, taskEditingLocked } from "@/domain/task-edit-lock";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { attachmentReader } from "@/youtrack/attachment-reader";
import { useLayoutEffect, useRef, useState } from "react";
import type { useAttachmentWork } from "./use-attachment-work";
export const useAttachmentInventory = (
  item: TaskItem,
  work: ReturnType<typeof useAttachmentWork>,
  quietRead: boolean,
) => {
  const [readOnlyFiles, setReadOnlyFiles] = useState<{
    id: string;
    files: Attachment[];
    check: () => void;
  } | null>(null);
  const itemRef = useRef({ id: item.id, active: false });
  useLayoutEffect(() => {
    const scope = { id: item.id, active: true };
    itemRef.current = scope;
    return () => {
      scope.active = false;
    };
  }, [item.id]);
  const read = () => {
    const scope = itemRef.current;
    const epoch = workspaceStore.deliveryEpoch();
    const readOnly = taskEditingLocked(item.id);
    work.run(async () => {
      const assertCurrent = authRequestGuard(authToken());
      const files = await attachmentReader().list(item.id);
      assertCurrent();
      if (!scope.active || scope.id !== item.id) return;
      if (previewRequired(epoch, readOnly)) {
        setReadOnlyFiles({ id: item.id, files, check: assertCurrent });
        work.setMessage(
          "Current attachments read for review. Saved queue and baseline unchanged.",
        );
        return;
      }
      setReadOnlyFiles(null);
      await workspaceStore.change((data) => {
        data.attachmentLists ??= {};
        data.attachmentLists[item.id] = files;
      });
      await workspaceStore.flush();
      if (!quietRead)
        work.setMessage(
          files.length + " attachments read. No file mutation was sent.",
        );
    });
  };
  let visibleFiles: Attachment[] | undefined;
  if (readOnlyFiles?.id === item.id) {
    try {
      readOnlyFiles.check();
      visibleFiles = readOnlyFiles.files;
    } catch {
      /* Expired account preview stays hidden. */
    }
  }
  return { read, readOnlyFiles: visibleFiles };
};
