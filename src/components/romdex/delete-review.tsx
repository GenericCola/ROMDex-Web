import { descendants } from "@/domain/accepted/core.mjs";
import { deleteTask } from "@/domain/task-actions";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import Dialog from "./dialog";
const DeleteReview = ({
  item,
  items,
  close,
}: {
  item: TaskItem;
  items: TaskItem[];
  close: () => void;
}) => {
  const confirm = () => {
    void workspaceStore.change((next) => {
      return deleteTask(next, item.id);
    });
    close();
  };
  const render = (id: string) => {
    return (
      <li key={id}>
        {
          items.find((candidate) => {
            return candidate.id === id;
          })?.summary
        }
      </li>
    );
  };
  return (
    <Dialog title="Queue deletion of listed tasks?" close={close}>
      <p>
        Connected delivery permanently deletes the listed YouTrack tasks. New
        local tasks that have never been sent are cancelled in this browser.
        Pending edits are archived in recovery. A recovery copy cannot restore
        deleted YouTrack IDs, comments or attachments.
      </p>
      <ul>{[item.id, ...descendants(items, item.id)].map(render)}</ul>
      <div className="dialog-actions">
        <button onClick={close}>Cancel</button>
        <button className="danger" onClick={confirm}>
          Delete Listed Items
        </button>
      </div>
    </Dialog>
  );
};
export default DeleteReview;
