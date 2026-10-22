import { descendants, indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import WorkRow from "./work-row";
interface WorkTableProps {
  data: WorkspaceData;
  items: TaskItem[];
  add: (parentId: string | null) => void;
}
const WorkTable = ({ data, items, add }: WorkTableProps) => {
  const tree = indexTree(items, data.order);
  const { scope } = data.view;
  const allowed = scope ? new Set(descendants(items, scope)) : null;
  const query = data.view.search.trim().toLowerCase();
  const rows: TaskItem[] = [];
  const collect = (parentId: string | null) => {
    for (const item of tree.children.get(parentId) ?? []) {
      const visible =
        (!allowed || allowed.has(item.id)) &&
        (!data.view.hideCompleted || tree.colors.get(item.id) !== "green") &&
        (!query ||
          (item.summary + " " + item.id + " " + item.description)
            .toLowerCase()
            .includes(query));
      if (visible) rows.push(item);
      if (
        query ||
        data.view.expanded.includes(item.id) ||
        item.id === scope ||
        (allowed && !allowed.has(item.id))
      )
        collect(item.id);
    }
  };
  collect(null);
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
      />
    );
  };
  return (
    <section
      id="work-tray"
      className="workspace suite-tray"
      aria-label="Work Tray"
    >
      <div className="work-header">
        <div className="work-title-row">
          <h2>{scope ? tree.byId.get(scope)?.summary : "Your Project"}</h2>
        </div>
        <div className="work-toolbar">
          <div className="tools">
            <label className="search-label">
              <input
                type="search"
                placeholder="Search This View…"
                aria-label="Search This View"
                value={data.view.search}
                onChange={search}
              />
            </label>
            <button onClick={expand}>Expand All</button>
            <button onClick={collapse}>Collapse All</button>
            <button onClick={addItem}>+ Add Item</button>
          </div>
          <button onClick={completed} aria-pressed={data.view.hideCompleted}>
            {data.view.hideCompleted ? "Show Completed" : "Hide Completed"}
          </button>
        </div>
      </div>
      <div className="work-body">
        <section className="table-area" aria-label="Task List">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="title-column">Name</th>
                  <th>Priority</th>
                  <th>Complexity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{rows.map(render)}</tbody>
            </table>
            {rows.length === 0 && (
              <div className="empty">
                <h3>No Items Here Yet</h3>
                <p>Add an item to start organizing this section.</p>
              </div>
            )}
          </div>
          <footer className="work-footer">
            <span>{rows.length} visible</span>
            <span>
              Changes stay in this browser until cloud delivery is enabled.
            </span>
          </footer>
        </section>
      </div>
    </section>
  );
};
export default WorkTable;
