import Dialog from "./dialog";
import type { useAttachments } from "./use-attachments";
const AttachmentDeleteReview = ({
  model,
  issueId,
}: {
  model: ReturnType<typeof useAttachments>;
  issueId: string;
}) => {
  const close = () => {
    model.setRemoving(null);
  };
  return model.removing ? (
    <Dialog title="Queue deletion of this attachment?" close={close}>
      <p>
        Connected Save Changes permanently deletes {model.removing.name} from{" "}
        {issueId}. Recovery preserves the request and metadata; it cannot
        restore a deleted YouTrack attachment ID.
      </p>
      <p>
        ID {model.removing.id} · {model.removing.size} bytes
      </p>
      <p role="status">{model.message}</p>
      <div className="port-actions">
        <button disabled={model.busy} onClick={model.remove}>
          Queue Attachment Deletion
        </button>
        <button onClick={close}>Cancel</button>
      </div>
    </Dialog>
  ) : null;
};
export default AttachmentDeleteReview;
