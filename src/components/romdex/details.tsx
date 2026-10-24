import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import DeleteReview from "./delete-review";
import TaskAttachments from "./task-attachments";
import TaskImage from "./task-image";
import TaskProperties from "./task-properties";
import TaskWriting from "./task-writing";
const Details = ({
  data,
  items,
}: {
  data: WorkspaceData;
  items: TaskItem[];
}) => {
  const [deleting, setDeleting] = useState(false);
  const item = items.find((candidate) => {
    return candidate.id === data.view.selected;
  });
  const resize = () => {
    void workspaceStore.change((next) => {
      next.view.detailsMode =
        next.view.detailsMode === "expanded" ? "default" : "expanded";
    });
  };
  const minimize = () => {
    void workspaceStore.change((next) => {
      next.view.detailsMode = "collapsed";
    });
  };
  const askDelete = () => {
    return setDeleting(true);
  };
  const cancelDelete = () => {
    return setDeleting(false);
  };
  return (
    <>
      <aside
        id="details"
        className="details suite-tray"
        aria-label="Task Details"
      >
        <div className="detail-top">
          <span>
            {item?.id.startsWith("local-")
              ? "Local item"
              : (item?.id ?? "Task Details")}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Expand Details Tray"
              aria-pressed={data.view.detailsMode === "expanded"}
              onClick={resize}
            >
              ↗
            </button>
            <button
              className="icon-button"
              aria-label="Minimize Details Tray"
              onClick={minimize}
            >
              −
            </button>
          </div>
        </div>
        {item ? (
          <div className="detail-scroll">
            <TaskProperties item={item} data={data} remove={askDelete} />
            <div className="port-detail-content">
              <TaskWriting item={item} data={data} />
              <TaskImage id={item.id} data={data} />
              <TaskAttachments key={item.id} item={item} data={data} />
            </div>
          </div>
        ) : (
          <div className="detail-placeholder">
            <h2>Select a Task</h2>
            <p>
              Choose a task in the Work Tray to view its notes, comments, and
              properties.
            </p>
          </div>
        )}
      </aside>
      {deleting && item && (
        <DeleteReview item={item} items={items} close={cancelDelete} />
      )}
    </>
  );
};
export default Details;
