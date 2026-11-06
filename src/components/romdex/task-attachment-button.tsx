import type { TaskItem } from "@/domain/types";
import { useOpenAttachments } from "./task-attachment-context";
const TaskAttachmentButton = ({
  item,
  count,
}: {
  item: TaskItem;
  count: number;
}) => {
  const open = useOpenAttachments();
  if (!count) return null;
  return (
    <button
      className="note-button attachment-button"
      aria-label={"Attachments for " + item.summary}
      title={count + " Attachment" + (count === 1 ? "" : "s")}
      onClick={() => {
        open(item.id);
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M6 11l5-5a2 2 0 0 0-3-3L3 8a3.5 3.5 0 0 0 5 5l5-5M5 9l4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};
export default TaskAttachmentButton;
