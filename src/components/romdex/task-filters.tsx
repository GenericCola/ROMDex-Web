import {
  emptyFilters,
  filterFields,
  filtersActive,
  type TaskFilters,
} from "@/domain/task-filters";
import type { TaskItem } from "@/domain/types";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Dialog from "./dialog";
const TaskFilterControl = ({
  items,
  filters,
  change,
}: {
  items: TaskItem[];
  filters: TaskFilters;
  change: (filters: TaskFilters) => void;
}) => {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = () => {
    if (!open) return;
    const button = launcherRef.current;
    const focusLauncher = () => {
      button?.focus();
    };
    return focusLauncher;
  };
  useEffect(restoreFocus, [open]);
  const show = () => {
      setOpen(true);
    },
    close = () => {
      setOpen(false);
    },
    clear = () => {
      change(emptyFilters());
    };
  const fields = filterFields(items);
  const renderOption = ([value, label]: [string, string]) => {
    return (
      <option key={value} value={value}>
        {label}
      </option>
    );
  };
  const renderField = (field: (typeof fields)[number]) => {
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      change({ ...filters, [field.key]: event.target.value });
    };
    return (
      <label key={field.key}>
        {field.label}
        <select
          aria-label={"Filter " + field.label}
          value={filters[field.key]}
          onChange={handleChange}
        >
          <option value="">{field.all}</option>
          {field.options.map(renderOption)}
        </select>
      </label>
    );
  };
  return (
    <>
      <button
        ref={launcherRef}
        className="task-filter-button"
        aria-label="Filters"
        title="Filters"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-pressed={filtersActive(filters)}
        onClick={show}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 5h18M3 12h18M3 19h18" />
          <path d="M8 2v6M16 9v6M10 16v6" />
        </svg>
      </button>
      {open && (
        <Dialog title="Filters" close={close}>
          <p>Show only tasks matching all selected filters.</p>
          <div className="task-filter-fields">{fields.map(renderField)}</div>
          <div className="dialog-actions">
            <button onClick={close}>Close</button>
            <button onClick={clear}>Clear All</button>
          </div>
        </Dialog>
      )}
    </>
  );
};
export default TaskFilterControl;
