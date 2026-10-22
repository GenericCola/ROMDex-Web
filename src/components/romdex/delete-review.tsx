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
    <Dialog title="Delete items from this browser?" close={close}>
      <p>
        These items and descendants will be queued for deletion. Deletion
        delivery is not supported yet.
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
