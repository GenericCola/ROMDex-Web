import type { emptyFilters } from "@/domain/task-filters";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { tw } from "@utils/tw";
import type { ChangeEvent } from "react";
import { completedControl } from "./indicator-status";
import PlanImportButton from "./plan-import-button";
import TaskFilterControl from "./task-filters";
import WorkHeading from "./work-heading";
import WorkspaceTools from "./workspace-tools";
const WorkToolbar = ({
  items,
  data,
  filters,
  setFilters,
  locked,
  search,
  expand,
  collapse,
  addItem,
  completed,
}: {
  items: TaskItem[];
  data: WorkspaceData;
  filters: ReturnType<typeof emptyFilters>;
  setFilters: (filters: ReturnType<typeof emptyFilters>) => void;
  locked: boolean;
  search: (event: ChangeEvent<HTMLInputElement>) => void;
  expand: () => void;
  collapse: () => void;
  addItem: () => void;
  completed: () => void;
}) => {
  const filter = completedControl(data.view.hideCompleted);
  return (
    <div className="work-header" inert={locked}>
      <WorkHeading items={items} data={data} />
      <div className="work-toolbar">
        <div className="tools">
          <label className="search-label">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search This View…"
              aria-label="Search This View"
              value={data.view.search}
              onChange={search}
            />
          </label>
          <TaskFilterControl
            items={items}
            filters={filters}
            change={setFilters}
          />
          <button onClick={expand}>Expand All</button>
          <button onClick={collapse}>Collapse All</button>
          <button onClick={addItem}>+ Add Item</button>
          <PlanImportButton />
        </div>
        <div className="work-toolbar-actions">
          <button
            id="toggle-completed"
            onClick={completed}
            aria-pressed={data.view.hideCompleted}
            title={filter.title}
          >
            {filter.label}
            <span className={tw("bulb", filter.color)} aria-hidden="true" />
          </button>
          <WorkspaceTools />
        </div>
      </div>
    </div>
  );
};
export default WorkToolbar;
