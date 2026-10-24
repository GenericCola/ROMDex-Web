import { deliveryConnected } from "@/cloud/session";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import AttachmentCache from "./attachment-cache";
import AttachmentDeleteReview from "./attachment-delete-review";
import { useAttachments } from "./use-attachments";
const TaskAttachments = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const model = useAttachments(item),
    files = data.attachmentLists?.[item.id] ?? [],
    pending = data.operations.filter((op) => {
      return (
        op.issueId === item.id &&
        (op.type === "attachment" || op.type === "attachment-delete")
      );
    });
  return (
    <section className="port-attachments" aria-label="Task Attachments">
      <h3>Attachments</h3>
      <p>
        Cached metadata stays available offline. Read attachments to verify the
        current inventory. Uploads are limited to 10 MiB per file.
      </p>
      <button
        disabled={
          model.busy || !deliveryConnected() || item.id.startsWith("local-")
        }
        onClick={model.read}
      >
        Read Attachments
      </button>
      <label>
        Stage a file
        <input
          type="file"
          disabled={model.busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) model.stage(file);
            event.target.value = "";
          }}
        />
      </label>
      <p role="status">
        {model.busy ? "Attachment operation in progress" : model.message}
      </p>
      <ul>
        {files.map((file) => {
          return (
            <li key={file.id}>
              {file.name} · {file.size} bytes · ID {file.id}
              <button
                disabled={model.busy || !deliveryConnected()}
                onClick={() => {
                  model.download(file);
                }}
              >
                Download {file.name}
              </button>
              <button
                disabled={model.busy}
                onClick={() => {
                  model.setRemoving(file);
                }}
              >
                Remove {file.name}
              </button>
            </li>
          );
        })}
      </ul>
      <h4>Queued file requests</h4>
      <ul>
        {pending.map((op) => {
          return (
            <li key={op.opId}>
              {op.type === "attachment" ? (
                <>
                  Upload {op.file.name} · {op.file.size} bytes
                  <button
                    disabled={model.busy}
                    onClick={() => {
                      model.exportPending(op.uploadId);
                    }}
                  >
                    Export Staged {op.file.name}
                  </button>
                  <button
                    disabled={model.busy}
                    onClick={() => {
                      model.cancel(op.opId);
                    }}
                  >
                    Cancel Staged {op.file.name}
                  </button>
                  <label>
                    Restore queued bytes for {op.file.name}
                    <input
                      type="file"
                      disabled={model.busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) model.restore(op, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </>
              ) : op.type === "attachment-delete" ? (
                <>
                  Delete {op.base.name} · ID {op.attachmentId}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      <AttachmentCache />
      <AttachmentDeleteReview model={model} issueId={item.id} />
    </section>
  );
};
export default TaskAttachments;
