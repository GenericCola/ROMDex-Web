import {
  archivedUploadCandidates,
  checkCacheRemoval,
} from "@/attachments/cache";
import type { StoredUpload } from "@/attachments/types";
import { sameUploadFile } from "@/attachments/validate";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { useState } from "react";
import Dialog from "./dialog";
import { useAttachmentWork } from "./use-attachment-work";
const AttachmentCache = () => {
  const work = useAttachmentWork(),
    [files, setFiles] = useState<(StoredUpload & { issueId: string })[] | null>(
      null,
    ),
    [approved, setApproved] = useState(false);
  const review = () => {
    work.run(async () => {
      setFiles(
        await archivedUploadCandidates(
          workspaceStore.getSnapshot().data,
          uploadStorage,
        ),
      );
      setApproved(false);
      work.setMessage("");
    });
  };
  const remove = () => {
    if (!files || !approved) return;
    work.run(async () => {
      await workspaceStore.change((data) => {
        checkCacheRemoval(data, files);
      });
      await workspaceStore.flush();
      for (const file of files) {
        checkCacheRemoval(workspaceStore.getSnapshot().data, [file]);
        const current = await uploadStorage.get(file.id);
        if (current && !sameUploadFile(current.file, file.file))
          throw Error("Staged bytes changed. Review the list again.");
        await uploadStorage.remove(file.id);
      }
      work.setMessage(
        files.length +
          " archived staged copies removed. Original files and cloud attachments are unchanged.",
      );
      setFiles(null);
    });
  };
  return (
    <>
      <button disabled={work.busy} onClick={review}>
        Review Archived Staged Copies
      </button>
      <p role="status">{work.message}</p>
      {files && (
        <Dialog
          title="Remove listed archived staged copies?"
          close={() => {
            setFiles(null);
          }}
        >
          <p>
            Only these local staged copies will be removed. Active upload bytes
            are excluded. Original files, queued metadata and YouTrack
            attachments stay unchanged.
          </p>
          <ul>
            {files.map((file) => {
              return (
                <li key={file.id}>
                  {file.issueId} · {file.file.name} · {file.file.size} bytes
                </li>
              );
            })}
          </ul>
          <label className="port-check-line">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => {
                setApproved(event.target.checked);
              }}
            />
            I exported a recovery copy and want to remove only these archived
            staged bytes.
          </label>
          <p role="status">{work.message}</p>
          <div className="port-actions">
            <button
              disabled={work.busy || !approved || !files.length}
              onClick={remove}
            >
              Remove Listed Staged Copies
            </button>
            <button
              onClick={() => {
                setFiles(null);
              }}
            >
              Cancel
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
};
export default AttachmentCache;
