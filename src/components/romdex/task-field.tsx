import { fieldChoices, fieldPresentation } from "@/domain/field-presentation";
import { editTask } from "@/domain/task-actions";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
const badgeClasses: Record<string, string> = {
  green: "field-tag green",
  blue: "field-tag blue",
  yellow: "field-tag yellow",
  red: "field-tag red",
  unset: "field-tag unset",
};
const TaskField = ({
  item,
  field,
}: {
  item: TaskItem;
  field: keyof typeof fieldChoices;
}) => {
  const value = item[field];
  const shown = fieldPresentation(field, value);
  const choices = fieldChoices[field];
  const change = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    void workspaceStore.change((data) => {
      editTask(
        data,
        item.id,
        field === "priority"
          ? { priority: next }
          : { complexity: next || null },
      );
    });
  };
  return (
    <label className="field-control">
      <span className={badgeClasses[shown.color]} aria-hidden="true">
        {shown.label}
      </span>
      <select
        className="field-select"
        aria-label={field + " for " + item.summary}
        title={
          field === "priority" && value === "Show-stopper"
            ? "Current native value: Show-stopper. Choosing URGENT queues Critical. Remote delivery requires connection review."
            : "Changes are queued in this browser. Remote delivery requires connection review."
        }
        value={value ?? ""}
        onChange={change}
      >
        {field === "complexity" && <option value="">—</option>}
        {value !== null &&
          !choices.some((choice) => {
            return choice.value === value;
          }) && (
            <option value={value}>
              {shown.label} · {value} (Current)
            </option>
          )}
        {choices.map((choice) => {
          return (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          );
        })}
      </select>
    </label>
  );
};
export default TaskField;
