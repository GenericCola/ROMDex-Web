import { isRasterAttachment } from "@/attachments/preview";
import { fileSize } from "@/attachments/rows";
import type { WorkspaceData } from "@/domain/types";
import type { useAttachments } from "./use-attachments";
const QueuedAttachments = ({
  data,
  id,
  model,
}: {
  data: WorkspaceData;
  id: string;
  model: ReturnType<typeof useAttachments>;
}) => {
  return (
    <ul className="attachment-list">
      {data.operations
        .filter((op) => {
          return op.issueId === id && op.type === "attachment";
        })
        .map((op) => {
          const held = !!data.cloud?.records[op.opId];
          return (
            <li key={op.opId}>
              {op.type === "attachment" ? (
                <>
                  <div className="attachment-label">
                    <strong title={op.file.name}>{op.file.name}</strong>
                    <small>
                      {fileSize(op.file.size)} ·{" "}
                      {held
                        ? "Review Required"
                        : id.startsWith("local-")
                          ? "Queued · Waiting for Ticket Creation"
                          : "Queued · Not Yet Uploaded"}
                    </small>
                  </div>
                  <div className="attachment-actions">
                    {isRasterAttachment(op.file.mimeType) && (
                      <button
                        disabled={model.busy}
                        onClick={() => {
                          model.viewPending(op.uploadId);
                        }}
                      >
                        View
                      </button>
                    )}
                    <button
                      disabled={model.busy}
                      onClick={() => {
                        model.exportPending(op.uploadId);
                      }}
                    >
                      Download
                    </button>
                    <button
                      disabled={model.busy || held}
                      onClick={() => {
                        model.cancel(op.opId);
                      }}
                    >
                      Cancel Upload
                    </button>
                    <details>
                      <summary>Restore Local Bytes</summary>
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
                    </details>
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
    </ul>
  );
};
export default QueuedAttachments;
