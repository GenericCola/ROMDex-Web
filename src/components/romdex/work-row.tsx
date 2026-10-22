import { hasMeaningfulNotes, indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import Lamp from "./lamp";
const WorkRow = ({
  item,
  data,
  tree,
  scope,
  add,
}: {
  item: TaskItem;
  data: WorkspaceData;
  tree: ReturnType<typeof indexTree>;
  scope: string | null;
  add: (parentId: string | null) => void;
}) => {
  const depth =
    (tree.depths.get(item.id) ?? 0) -
    (scope ? (tree.depths.get(scope) ?? 0) + 1 : 0);
  const children = tree.children.get(item.id) ?? [];
  const expanded = data.view.expanded.includes(item.id);
  const select = () => {
    void workspaceStore.change((next) => {
      next.view.selected = item.id;
      if (next.view.detailsMode === "collapsed")
        next.view.detailsMode = "default";
    });
  };
  const toggle = () => {
    void workspaceStore.change((next) => {
      next.view.expanded = expanded
        ? next.view.expanded.filter((id) => {
            return id !== item.id;
          })
        : [...next.view.expanded, item.id];
    });
  };
  const addChild = () => {
    return add(item.id);
  };
  return (
    <tr
      className={
        "task-row" + (data.view.selected === item.id ? " selected" : "")
      }
    >
      <td>
        <div
          className="port-task-name"
          style={{ paddingLeft: Math.max(0, depth) * 18 }}
        >
          {children.length > 0 ? (
            <button
              className="port-selector-toggle"
              aria-label={(expanded ? "Collapse " : "Expand ") + item.summary}
              aria-expanded={expanded}
              onClick={toggle}
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span aria-hidden="true">·</span>
          )}
          <Lamp color={tree.colors.get(item.id) ?? "grey"} />
          <button
            className="port-item-name"
            title={item.summary}
            onClick={select}
          >
            {data.titleDrafts[item.id] ?? item.summary}
          </button>
          {hasMeaningfulNotes(item.description) && (
            <span title="Notes and instructions" aria-label="Has notes">
              ▤
            </span>
          )}
          <small>{item.id.startsWith("local-") ? "Local" : item.id}</small>
        </div>
      </td>
      <td>{item.priority.toUpperCase()}</td>
      <td>{item.complexity?.toUpperCase() ?? "—"}</td>
      <td>
        <button aria-label={"Add child to " + item.summary} onClick={addChild}>
          +
        </button>
      </td>
    </tr>
  );
};
export default WorkRow;
