import { taskEditingLocked } from "@/domain/task-edit-lock";
import type { TaskItem } from "@/domain/types";
import { workspaceItems } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import DeleteReview from "./delete-review";
import { LazyItemEditDialog } from "./lazy-views";
import { useFreshTask } from "./use-fresh-task";
const TaskRowActions = ({
  item,
  add,
}: {
  item: TaskItem;
  add: (parentId: string | null) => void;
}) => {
  const fresh = useFreshTask(item.id);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="row-actions">
      <button
        disabled={taskEditingLocked(item.id)}
        title="Add Subtask"
        aria-label={"Add child to " + item.summary}
        onClick={() => {
          add(item.id);
        }}
      >
        +
      </button>
      <button
        disabled={taskEditingLocked(item.id) || fresh.checking}
        className={fresh.slow ? "romdex-fresh-checking" : undefined}
        aria-busy={fresh.slow ? "true" : undefined}
        title={fresh.checking ? "Checking latest ticket…" : "Edit Item"}
        aria-label={"Edit " + item.summary}
        onClick={() => {
          fresh.open((current) => {
            setEditing(structuredClone(current));
          });
        }}
      >
        ✎
      </button>
      <button
        disabled={taskEditingLocked(item.id)}
        title="Delete Item"
        aria-label={"Delete " + item.summary}
        onClick={() => {
          setDeleting(true);
        }}
      >
        <svg className="trash-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5 1h6v2h3v2H2V3h3V1zM6 2v1h4V2H6zM3 6h10l-1 9H4L3 6zm3 1v6h1V7H6zm3 0v6h1V7H9z"
          />
        </svg>
      </button>
      {fresh.error && <p role="status">{fresh.error}</p>}
      {editing && (
        <LazyItemEditDialog
          item={editing}
          close={() => {
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteReview
          item={item}
          items={workspaceItems(workspaceStore.getSnapshot().data)}
          close={() => {
            setDeleting(false);
          }}
        />
      )}
    </div>
  );
};
export default TaskRowActions;
