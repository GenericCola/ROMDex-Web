import { registerDraftEditor } from "@/domain/editor-drafts";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { attachmentsReadable } from "@/youtrack/attachment-reader";
import { useEffect, useRef } from "react";
import AttachmentPreview from "./attachment-preview";
import Dialog from "./dialog";
import TaskAttachments from "./task-attachments";
import { useAttachments } from "./use-attachments";
const TaskAttachmentDialog = ({
  item,
  data,
  close,
}: {
  item: TaskItem;
  data: WorkspaceData;
  close: () => void;
}) => {
  const model = useAttachments(item);
  const initialReadRef = useRef<string | null>(null);
  const { read } = model;
  useEffect(() => {
    if (initialReadRef.current === item.id || !/^PMON-\d+$/.test(item.id))
      return;
    if (!attachmentsReadable()) return;
    initialReadRef.current = item.id;
    read();
  }, [item.id, read]);
  useEffect(() => {
    return registerDraftEditor({
      ticketIds: [item.id],
      label: "Close Attachments before switching accounts or updating.",
      dirty: () => {
        return true;
      },
      flush: () => {
        return Promise.reject(Error("Close Attachments before continuing."));
      },
    });
  }, [item.id]);
  return (
    <Dialog
      id="attachments-dialog"
      desktop
      title="Attachments"
      close={close}
      canClose={!model.busy}
      className="attachments-dialog"
    >
      <p id="attachment-target" className="muted">
        {item.summary} · {item.id.startsWith("local-") ? "New Item" : item.id}
      </p>
      <TaskAttachments item={item} data={data} model={model} />
      <div className="dialog-actions">
        <button onClick={close} disabled={model.busy}>
          Close
        </button>
      </div>
      {model.preview && (
        <AttachmentPreview
          key={model.preview.url}
          file={model.preview}
          close={model.closePreview}
        />
      )}
    </Dialog>
  );
};
export default TaskAttachmentDialog;
