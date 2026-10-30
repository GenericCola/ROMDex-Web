import { indexTree, materialize } from "@/domain/accepted/core.mjs";
import { needsDeliveryReview } from "@/domain/review-browsing";
import { editTask } from "@/domain/task-actions";
import { taskAssigneeLabel } from "@/domain/task-assignee-label";
import { itemName, taskTier } from "@/domain/task-presentation";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent, ReactNode } from "react";
import TaskField from "./task-field";
import TaskStatusPopup from "./task-status-popup";
import TaskSummaryChildren from "./task-summary-children";
import { useTaskTextEditing } from "./use-task-text-editing";
const TaskProperties = ({
  item,
  data,
  remove,
  children,
}: {
  item: TaskItem;
  data: WorkspaceData;
  remove: () => void;
  children?: ReactNode;
}) => {
  const readOnly = needsDeliveryReview(data);
  const editing = useTaskTextEditing(item.id, "title");
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  const parents: string[] = [];
  let parent = tree.byId.get(item.parentId ?? "");
  while (parent) {
    parents.unshift(itemName(parent));
    parent = tree.byId.get(parent.parentId ?? "");
  }
  const inherited = !!tree.children.get(item.id)?.length;
  const title = (event: ChangeEvent<HTMLInputElement>) => {
    if (needsDeliveryReview(workspaceStore.getSnapshot().data)) return;
    const { value } = event.target;
    void workspaceStore.change((next) => {
      next.titleDrafts[item.id] = value;
    });
  };
  const commitTitle = () => {
    editing.blur();
    if (needsDeliveryReview(workspaceStore.getSnapshot().data)) return;
    if (data.titleDrafts[item.id]?.trim())
      void workspaceStore.change((next) => {
        editTask(next, item.id, {
          summary: next.titleDrafts[item.id]?.trim() ?? item.summary,
        });
        delete next.titleDrafts[item.id];
      });
  };
  return (
    <section className="detail-summary" aria-label="Task Properties">
      <p id="detail-parent" className="eyebrow">
        {parents.join(" / ") || "Top-Level Epic"}
      </p>
      <input
        id="detail-title"
        readOnly={readOnly}
        className="detail-title"
        aria-label="Task Title"
        value={data.titleDrafts[item.id] ?? item.summary}
        onChange={title}
        onFocus={editing.focus}
        onBlur={commitTitle}
      />
      {data.titleDrafts[item.id] !== undefined &&
        !data.titleDrafts[item.id]?.trim() && (
          <p role="alert">Enter an item name. Your draft is kept.</p>
        )}
      <div className="detail-properties">
        <TaskStatusPopup
          item={item}
          color={tree.colors.get(item.id) ?? "grey"}
          inherited={inherited}
          compact={false}
        />
        <span className="detail-field">
          Priority <TaskField item={item} field="priority" />
        </span>
        <span className="detail-field">
          Complexity <TaskField item={item} field="complexity" />
        </span>
      </div>
      <div className="detail-extra">
        <span>{taskTier(tree.depths.get(item.id) ?? 0)}</span>
        <span>Assignee: {taskAssigneeLabel(item)}</span>
        <span>Due Date: {item.dueDate ?? "Not Set"}</span>
        {inherited && <span>Status Inherited from Children</span>}
      </div>
      <TaskSummaryChildren item={item} tree={tree} />
      {children}
      <div className="detail-bottom">
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open in YouTrack ↗
          </a>
        )}
        <button
          className="danger text-button"
          onClick={remove}
          disabled={readOnly}
        >
          Delete Item
        </button>
      </div>
    </section>
  );
};
export default TaskProperties;
