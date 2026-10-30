import { needsDeliveryReview } from "@/domain/review-browsing";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { attachmentsReadable } from "@/youtrack/attachment-reader";
import AttachmentCache from "./attachment-cache";
import AttachmentDeleteReview from "./attachment-delete-review";
import NativeAttachmentList from "./native-attachment-list";
import QueuedAttachments from "./queued-attachments";
import type { useAttachments } from "./use-attachments";
const TaskAttachments = ({
  item,
  data,
  model,
}: {
  item: TaskItem;
  data: WorkspaceData;
  model: ReturnType<typeof useAttachments>;
}) => {
  return (
    <section className="desktop-attachments" aria-label="Task Attachments">
      <label className="attach-file-control">
        Attach Files
        <input
          type="file"
          className="sr-only"
          aria-label="Attach Files"
          multiple
          disabled={model.busy || needsDeliveryReview(data)}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length) model.stageMany(files);
            event.target.value = "";
          }}
        />
      </label>
      <button
        disabled={
          model.busy || !attachmentsReadable() || item.id.startsWith("local-")
        }
        onClick={model.read}
      >
        Refresh Attachments
      </button>
      <p className="muted small">
        Cached metadata stays available offline. Up to 10 files at once, 10 MiB
        per file.
      </p>
      <p className="small" role="status" hidden={!model.busy && !model.message}>
        {model.busy ? "Attachment operation in progress" : model.message}
      </p>
      <NativeAttachmentList
        data={
          model.readOnlyFiles
            ? {
                ...data,
                attachmentLists: {
                  ...data.attachmentLists,
                  [item.id]: model.readOnlyFiles,
                },
              }
            : data
        }
        id={item.id}
        model={model}
      />
      <QueuedAttachments data={data} id={item.id} model={model} />
      <details>
        <summary>Local File Recovery</summary>
        <AttachmentCache />
      </details>
      <AttachmentDeleteReview model={model} issueId={item.id} />
    </section>
  );
};
export default TaskAttachments;
