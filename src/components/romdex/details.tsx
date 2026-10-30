import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import DeleteReview from "./delete-review";
import DetailAttachments from "./detail-attachments";
import DetailHeading from "./detail-heading";
import { useDetailNavigation } from "./detail-navigation-context";
import TaskProperties from "./task-properties";
import TaskWriting from "./task-writing";
import { useWorkSelection } from "./work-selection-context";
const Details = ({
  data,
  items,
}: {
  data: WorkspaceData;
  items: TaskItem[];
}) => {
  const navigation = useDetailNavigation();
  const previous = items.find((entry) => {
    return entry.id === navigation.previous;
  });
  const [deleting, setDeleting] = useState(false);
  const multiple = useWorkSelection().selection.ids.length > 1;
  const item = items.find((candidate) => {
    return !multiple && candidate.id === data.view.selected;
  });
  const resize = () => {
    void workspaceStore.change((next) => {
      if (next.view.detailsMode === "expanded")
        next.view.automaticTrayHeight = true;
      next.view.detailsMode =
        next.view.detailsMode === "expanded" ? "default" : "expanded";
    });
  };
  const minimize = () => {
    void workspaceStore.change((next) => {
      if (next.view.detailsMode === "expanded")
        next.view.automaticTrayHeight = true;
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
        <DetailHeading
          item={item}
          previous={previous}
          multiple={multiple}
          expanded={data.view.detailsMode === "expanded"}
          back={navigation.back}
          resize={resize}
          minimize={minimize}
        />
        {item ? (
          <div className="detail-scroll">
            <TaskProperties item={item} data={data} remove={askDelete}>
              <DetailAttachments key={item.id} item={item} data={data} />
            </TaskProperties>
            <TaskWriting item={item} data={data} />
          </div>
        ) : (
          <div className="detail-placeholder">
            <h2>
              {multiple ? "Multiple Items are Selected." : "Select a Task"}
            </h2>
            <p hidden={multiple}>
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
