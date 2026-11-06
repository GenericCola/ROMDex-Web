import { knownAttachmentCount } from "@/attachments/count";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { attachmentsReadable } from "@/youtrack/attachment-reader";
import { useEffect, useRef } from "react";
import AttachmentDeleteReview from "./attachment-delete-review";
import AttachmentPreview from "./attachment-preview";
import AttachmentStatus from "./attachment-status";
import NativeAttachmentList from "./native-attachment-list";
import QueuedAttachments from "./queued-attachments";
import { useOpenAttachments } from "./task-attachment-context";
import { useAttachments } from "./use-attachments";
const DetailAttachments = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const model = useAttachments(item, true),
    open = useOpenAttachments(),
    initialRef = useRef(false);
  const { read } = model;
  useEffect(() => {
    if (
      initialRef.current ||
      !/^PMON-\d+$/.test(item.id) ||
      !attachmentsReadable()
    )
      return;
    initialRef.current = true;
    read();
  }, [item.id, read]);
  return (
    <section id="detail-attachments" aria-label="Item Attachments">
      <div className="attachment-heading">
        <h3>Attachments ({knownAttachmentCount(data, item.id)})</h3>
        <button
          onClick={() => {
            return open(item.id);
          }}
        >
          Attach Files
        </button>
      </div>
      <NativeAttachmentList data={data} id={item.id} model={model} />
      <QueuedAttachments data={data} id={item.id} model={model} />
      <AttachmentStatus
        className="muted small"
        data={data}
        id={item.id}
        model={model}
      />
      <AttachmentDeleteReview model={model} issueId={item.id} />
      {model.preview && (
        <AttachmentPreview
          key={model.preview.url}
          file={model.preview}
          close={model.closePreview}
        />
      )}
    </section>
  );
};
export default DetailAttachments;
