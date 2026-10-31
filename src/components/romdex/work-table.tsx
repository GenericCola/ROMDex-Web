import { descendants, indexTree } from "@/domain/accepted/core.mjs";
import { emptyFilters, filtersActive } from "@/domain/task-filters";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workRows } from "@/domain/work-rows";
import { workspaceStore } from "@/domain/workspace-store";
import { useState, type ChangeEvent } from "react";
import { useWorkspaceDrag } from "./task-drag-context";
import TaskRows from "./task-rows";
import { useTableSelection } from "./use-table-selection";
import WorkEmpty from "./work-empty";
import WorkRow from "./work-row";
import WorkToolbar from "./work-toolbar";
interface WorkTableProps {
  data: WorkspaceData;
  items: TaskItem[];
  add: (parentId: string | null) => void;
}
const WorkTable = ({ data, items, add }: WorkTableProps) => {
  const [filters, setFilters] = useState(emptyFilters);
  const filtering = filtersActive(filters);
  const tree = indexTree(items, data.order);
  const { scope } = data.view;
  const scopeCount = scope ? descendants(items, scope).length : items.length;
  const rows = workRows(items, data, filters);
  const selection = useTableSelection(rows);
  const drag = useWorkspaceDrag();
  const search = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      next.view.search = value;
    });
  };
  const expand = () => {
    void workspaceStore.change((next) => {
      next.view.expanded = items.map((item) => {
        return item.id;
      });
    });
  };
  const collapse = () => {
    void workspaceStore.change((next) => {
      next.view.expanded = [];
    });
  };
  const completed = () => {
    void workspaceStore.change((next) => {
      next.view.hideCompleted = !next.view.hideCompleted;
    });
  };
  const addItem = () => {
    return add(scope);
  };
  const render = (item: TaskItem) => {
    return (
      <WorkRow
        key={item.id}
        item={item}
        data={data}
        tree={tree}
        scope={scope}
        add={add}
        checked={selection.selection.ids.includes(item.id)}
        selectionDisabled={selection.busy || !!selection.group}
        choose={selection.choose}
        dragging={drag.dragId === item.id}
        drop={
          drag.preview?.anchorId === item.id
            ? drag.preview.after
              ? "after"
              : "before"
            : null
        }
      />
    );
  };
  return (
    <section
      id="work-tray"
      className="workspace suite-tray"
      aria-label="Work Tray"
      onKeyDown={selection.keyDown}
      tabIndex={0}
    >
      <WorkToolbar
        items={items}
        data={data}
        filters={filters}
        setFilters={setFilters}
        locked={!!selection.group}
        search={search}
        expand={expand}
        collapse={collapse}
        addItem={addItem}
        completed={completed}
      />
      <div className="work-body">
        <section className="table-area" aria-label="Task List">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="title-column">Name</th>
                  <th>Priority</th>
                  <th>Complexity</th>
                  <th className="actions-column">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <TaskRows
                rows={rows}
                data={data}
                items={items}
                render={render}
                group={selection.group}
                closeGroup={selection.closeGroup}
              />
            </table>
            {rows.length === 0 && !data.newTask && (
              <WorkEmpty filtered={!!(filtering || data.view.search.trim())} />
            )}
          </div>
          <footer className="work-footer">
            <span>
              {rows.length} Visible / {scopeCount} in View
            </span>
            <span role="status">
              {drag.message ||
                selection.message ||
                "Drag to Reorder · Drag Sideways to Change Level"}
            </span>
          </footer>
        </section>
      </div>
    </section>
  );
};
export default WorkTable;
