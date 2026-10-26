import { STATES, STATUS, statusOf } from "@/domain/accepted/core.mjs";
import { editTask } from "@/domain/task-actions";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import TaskParent from "./task-parent";
import { useTaskTextEditing } from "./use-task-text-editing";
const option = (value: string) => {
  return <option key={value}>{value}</option>;
};
const statusOption = (value: string) => {
  return (
    <option key={value} value={value}>
      {statusOf(value) === "red" ? STATUS.red : value}
    </option>
  );
};
const TaskProperties = ({
  item,
  data,
  remove,
}: {
  item: TaskItem;
  data: WorkspaceData;
  remove: () => void;
}) => {
  const editing = useTaskTextEditing(item.id, "title");
  const title = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      next.titleDrafts[item.id] = value;
    });
  };
  const commitTitle = () => {
    editing.blur();
    if (data.titleDrafts[item.id]?.trim())
      void workspaceStore.change((next) => {
        editTask(next, item.id, {
          summary: next.titleDrafts[item.id]?.trim() ?? item.summary,
        });
        delete next.titleDrafts[item.id];
      });
  };
  const state = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      return editTask(next, item.id, { assignedState: value });
    });
  };
  const priority = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      return editTask(next, item.id, { priority: value });
    });
  };
  const complexity = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      return editTask(next, item.id, { complexity: value || null });
    });
  };
  const assignedState = item.assignedState ?? item.state;
  const displayedState =
    assignedState === "Needs Testing" ? STATES.amber : assignedState;
  const priorities = ["Minor", "Normal", "Major", "Critical", "Show-stopper"];
  return (
    <section className="detail-summary" aria-label="Task Properties">
      <input
        className="port-title"
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
        <TaskParent item={item} data={data} />
        <label>
          Status
          <select
            aria-label="Assigned Status"
            value={displayedState}
            onChange={state}
          >
            {!Object.values(STATES).includes(displayedState) &&
              statusOption(displayedState)}
            {Object.values(STATES).map(statusOption)}
          </select>
        </label>
        <label>
          Priority
          <select
            aria-label="Item Priority"
            value={item.priority}
            onChange={priority}
          >
            {!priorities.includes(item.priority) && option(item.priority)}
            {priorities.map(option)}
          </select>
        </label>
        <label>
          Complexity
          <select
            aria-label="Item Complexity"
            value={item.complexity ?? ""}
            onChange={complexity}
          >
            <option value="">Not Set</option>
            {["LOW", "MID", "HIGH", "INSANE"].map(option)}
          </select>
        </label>
      </div>
      <div className="detail-bottom">
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open in YouTrack ↗
          </a>
        )}
        <button className="danger text-button" onClick={remove}>
          Delete Item
        </button>
      </div>
    </section>
  );
};
export default TaskProperties;
