import { itemName } from "@/domain/task-presentation";
import type { TaskItem } from "@/domain/types";
interface Props {
  item: TaskItem | undefined;
  previous: TaskItem | undefined;
  multiple: boolean;
  expanded: boolean;
  back: () => void;
  resize: () => void;
  minimize: () => void;
}
const DetailHeading = ({
  item,
  previous,
  multiple,
  expanded,
  back,
  resize,
  minimize,
}: Props) => {
  return (
    <div className="detail-top">
      <div className="detail-location">
        <button
          id="detail-back"
          className="icon-button"
          disabled={!previous || multiple || !item}
          aria-label={previous ? "Back to " + itemName(previous) : "Back"}
          title={previous ? "Back to " + itemName(previous) : "Starting Item"}
          onClick={back}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13 8H3M7 4L3 8L7 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span id="detail-id">
          {item?.id.startsWith("local-")
            ? "New Item · Pending"
            : (item?.id ?? "Task Details")}
        </span>
      </div>
      <div>
        <button
          id="detail-expand"
          className="icon-button"
          aria-label={
            expanded ? "Restore Default Tray Split" : "Expand Details Tray"
          }
          title={
            expanded ? "Restore Default Tray Split" : "Expand Details Tray"
          }
          aria-pressed={expanded}
          onClick={resize}
        >
          <span className="detail-expand-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
        <button
          id="detail-minimize"
          className="icon-button"
          aria-label="Minimize Details Tray"
          title="Minimize Details Tray"
          onClick={minimize}
        >
          −
        </button>
      </div>
    </div>
  );
};
export default DetailHeading;
