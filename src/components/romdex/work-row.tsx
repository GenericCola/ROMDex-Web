import { hasMeaningfulNotes, indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import type { SelectionModifiers } from "@/domain/work-selection";
import { workspaceStore } from "@/domain/workspace-store";
import { rasterImage } from "@/npcdex/model";
import type { CSSProperties } from "react";
import RowGutter from "./row-gutter";
import TaskField from "./task-field";
import TaskRowActions from "./task-row-actions";
import TaskRowTitle from "./task-row-title";
import TaskStatusPopup from "./task-status-popup";
const WorkRow = ({
  item,
  data,
  tree,
  scope,
  add,
  checked,
  selectionDisabled,
  choose,
  clearSelection,
  dragging = false,
  drop = null,
}: {
  item: TaskItem;
  data: WorkspaceData;
  tree: ReturnType<typeof indexTree>;
  scope: string | null;
  add: (parentId: string | null) => void;
  checked: boolean;
  selectionDisabled: boolean;
  choose: (id: string, modifiers: SelectionModifiers) => void;
  clearSelection: () => void;
  dragging?: boolean;
  drop?: "before" | "after" | null;
}) => {
  const depth =
    (tree.depths.get(item.id) ?? 0) -
    (scope ? (tree.depths.get(scope) ?? 0) + 1 : 0);
  const children = tree.children.get(item.id) ?? [];
  const expanded = data.view.expanded.includes(item.id);
  const select = () => {
    clearSelection();
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
  return (
    <tr
      className={
        "task-row" +
        (dragging ? " dragging" : "") +
        (drop === "before"
          ? " drop-before"
          : drop === "after"
            ? " drop-after"
            : "") +
        (children.length ? " has-children" : "") +
        (data.view.selected === item.id || checked ? " selected" : "")
      }
      style={{ "--depth": Math.max(0, depth) } as CSSProperties}
      data-row={item.id}
      aria-selected={checked}
    >
      <td>
        <div className="task-cell">
          <RowGutter
            id={item.id}
            summary={item.summary}
            checked={checked}
            disabled={selectionDisabled}
            choose={choose}
          />
          <div className="row-hierarchy">
            {children.length > 0 ? (
              <button
                className="row-toggle"
                aria-label={(expanded ? "Collapse " : "Expand ") + item.summary}
                aria-expanded={expanded}
                onClick={toggle}
              >
                {expanded ? "▾" : "▸"}
              </button>
            ) : (
              <span className="row-toggle" aria-hidden="true" />
            )}
            {rasterImage(data.images?.[item.id]) && (
              <span
                className="port-task-thumbnail"
                role="img"
                aria-label={item.summary + " image"}
                style={{
                  backgroundImage:
                    "url(" + JSON.stringify(data.images?.[item.id]) + ")",
                }}
              />
            )}
            <TaskStatusPopup
              item={item}
              color={tree.colors.get(item.id) ?? "grey"}
              inherited={children.length > 0}
            />
            <div className="title-wrap">
              <TaskRowTitle item={item} data={data} select={select} />
              {hasMeaningfulNotes(item.description) && (
                <span title="Notes and instructions" aria-label="Has notes">
                  ▤
                </span>
              )}
              <span className="row-id">
                {item.id.startsWith("local-") ? "New · Pending" : item.id}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td>
        <TaskField item={item} field="priority" />
      </td>
      <td>
        <TaskField item={item} field="complexity" />
      </td>
      <td>
        <TaskRowActions item={item} items={[...tree.byId.values()]} add={add} />
      </td>
    </tr>
  );
};
export default WorkRow;
