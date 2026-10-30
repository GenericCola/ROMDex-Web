import { flushDraftEditors } from "@/domain/editor-drafts";
import {
  deletionSnapshot,
  queueReviewedDeletion,
} from "@/domain/reviewed-deletion";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import Dialog from "./dialog";
import { useSelectionWork } from "./use-selection-work";
const DeleteReview = ({
  item,
  items,
  close,
}: {
  item: TaskItem;
  items: TaskItem[];
  close: () => void;
}) => {
  const [reviewed] = useState(() => {
    return deletionSnapshot(items, item.id);
  });
  const { busy, message, run } = useSelectionWork();
  const confirm = () => {
    run(async () => {
      await flushDraftEditors();
      await workspaceStore.change((next) => {
        return queueReviewedDeletion(next, item.id, reviewed);
      });
      await workspaceStore.flush();
      close();
    });
  };
  const render = (task: TaskItem) => {
    return <li key={task.id}>{task.summary}</li>;
  };
  return (
    <Dialog
      id="delete-dialog"
      desktop
      title="Queue deletion of listed tasks?"
      close={close}
      canClose={!busy}
    >
      <p>
        Connected delivery permanently deletes the listed YouTrack tasks. New
        local tasks that have never been sent are cancelled in this browser.
        Pending edits are archived in recovery. A recovery copy cannot restore
        deleted YouTrack IDs, comments or attachments.
      </p>
      <ul>{reviewed.map(render)}</ul>
      <p role="status">{message}</p>
      <div className="dialog-actions">
        <button onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className="danger" onClick={confirm} disabled={busy}>
          Delete Listed Items
        </button>
      </div>
    </Dialog>
  );
};
export default DeleteReview;
