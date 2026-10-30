import type { TaskItem } from "@/domain/types";
import { useState } from "react";
import DeleteReview from "./delete-review";
import ItemEditDialog from "./item-edit-dialog";
const TaskRowActions = ({
  item,
  items,
  add,
}: {
  item: TaskItem;
  items: TaskItem[];
  add: (parentId: string | null) => void;
}) => {
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="row-actions">
      <button
        title="Add Subtask"
        aria-label={"Add child to " + item.summary}
        onClick={() => {
          add(item.id);
        }}
      >
        +
      </button>
      <button
        title="Edit Item"
        aria-label={"Edit " + item.summary}
        onClick={() => {
          setEditing(structuredClone(item));
        }}
      >
        ✎
      </button>
      <button
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
      {editing && (
        <ItemEditDialog
          item={editing}
          close={() => {
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteReview
          item={item}
          items={items}
          close={() => {
            setDeleting(false);
          }}
        />
      )}
    </div>
  );
};
export default TaskRowActions;
