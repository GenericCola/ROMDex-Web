import { isRasterAttachment } from "@/attachments/preview";
import { fileSize, nativeAttachmentRows } from "@/attachments/rows";
import { taskEditingLocked } from "@/domain/task-edit-lock";
import type { WorkspaceData } from "@/domain/types";
import { attachmentsReadable } from "@/youtrack/attachment-reader";
import { attachmentsReading } from "./attachments-reading";
import type { useAttachments } from "./use-attachments";
const NativeAttachmentList = ({
  data,
  id,
  model,
}: {
  data: WorkspaceData;
  id: string;
  model: ReturnType<typeof useAttachments>;
}) => {
  const rows = nativeAttachmentRows(data, id);
  const pendingUploads = data.operations.some((op) => {
    return op.issueId === id && op.type === "attachment";
  });
  return (
    <ul className="attachment-list">
      {!rows.length &&
        !pendingUploads &&
        !attachmentsReading(data, id, model) && (
          <li className="muted small">
            {data.attachmentLists?.[id] || id.startsWith("local-")
              ? "No Attachments"
              : "No Cached Attachments"}
          </li>
        )}
      {rows.map(({ file, deletion, held, status }) => {
        return (
          <li key={file.id}>
            <div className="attachment-label">
              <strong title={file.name}>{file.name}</strong>
              <small>
                {fileSize(file.size)} · {status}
              </small>
            </div>
            <div className="attachment-actions">
              {isRasterAttachment(file.mimeType) && (
                <button
                  disabled={model.busy || !attachmentsReadable()}
                  onClick={() => {
                    return model.view(file);
                  }}
                >
                  View
                </button>
              )}
              <button
                aria-label={"Download " + file.name}
                disabled={model.busy || !attachmentsReadable()}
                onClick={() => {
                  return model.download(file);
                }}
              >
                Download
              </button>
              {deletion ? (
                <button
                  disabled={model.busy || held || taskEditingLocked(id)}
                  onClick={() => {
                    return model.cancelDeletion(deletion.opId);
                  }}
                >
                  Cancel Deletion
                </button>
              ) : (
                <button
                  className="danger"
                  aria-label={"Delete " + file.name}
                  disabled={model.busy || taskEditingLocked(id)}
                  onClick={() => {
                    return model.setRemoving(file);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
export default NativeAttachmentList;
