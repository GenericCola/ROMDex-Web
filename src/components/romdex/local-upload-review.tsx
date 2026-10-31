import {
  cancelLocalUpload,
  restoreUploadBytes,
} from "@/attachments/restore-upload";
import type { AttachmentOperation } from "@/attachments/types";
const LocalUploadReview = ({
  operation,
  busy,
  execute,
}: {
  operation: Extract<AttachmentOperation, { type: "attachment" }>;
  busy: boolean;
  execute: (action: () => Promise<void>, success?: string) => Promise<void>;
}) => {
  return (
    <section className="delivery-review-card port-form">
      <h3>
        {operation.issueId}: {operation.file.name}
      </h3>
      <p>
        The original file is missing from this browser. No upload was sent.
        Other tickets can sync.
      </p>
      <label>
        Restore the original file
        <input
          type="file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file)
              void execute(async () => {
                await restoreUploadBytes(operation, file);
              }, "Original file restored. Save Changes uploads it.");
          }}
        />
      </label>
      <div className="port-actions">
        <button
          disabled={busy}
          onClick={() => {
            void execute(() => {
              return cancelLocalUpload(operation);
            }, "Upload cancelled. Nothing was sent to YouTrack.");
          }}
        >
          Cancel this upload
        </button>
      </div>
    </section>
  );
};
export default LocalUploadReview;
