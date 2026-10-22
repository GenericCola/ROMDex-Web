import { descendants, materialize } from "@/domain/accepted/core.mjs";
import { editTask } from "@/domain/task-actions";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
const TaskParent = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const items = materialize(data.remote, data.operations);
  const excluded = new Set([item.id, ...descendants(items, item.id)]);
  const candidates = items.filter((entry) => {
    return !excluded.has(entry.id);
  });
  const changeParent = (event: ChangeEvent<HTMLSelectElement>) => {
    const parentId = event.target.value || null;
    void workspaceStore.change((next) => {
      editTask(next, item.id, { parentId });
    });
  };
  const option = (entry: TaskItem) => {
    return (
      <option key={entry.id} value={entry.id}>
        {entry.summary} ({entry.id})
      </option>
    );
  };
  return (
    <label>
      Parent
      <select
        aria-label="Task Parent"
        value={item.parentId ?? ""}
        onChange={changeParent}
      >
        <option value="">No parent</option>
        {candidates.map(option)}
      </select>
    </label>
  );
};
export default TaskParent;
