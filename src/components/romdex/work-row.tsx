import { hasMeaningfulNotes, indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import type { SelectionModifiers } from "@/domain/work-selection";
import { workspaceStore } from "@/domain/workspace-store";
import type { CSSProperties } from "react";
import { useDetailNavigation } from "./detail-navigation-context";
import NotesIcon from "./notes-icon";
import RowGutter from "./row-gutter";
import TaskAttachmentButton from "./task-attachment-button";
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
  dragging?: boolean;
  drop?: "before" | "after" | null;
}) => {
  const depth =
    (tree.depths.get(item.id) ?? 0) -
    (scope ? (tree.depths.get(scope) ?? 0) + 1 : 0);
  const children = tree.children.get(item.id) ?? [];
  const expanded = data.view.expanded.includes(item.id);
  const navigation = useDetailNavigation();
  const select = () => {
    navigation.open(item.id);
  };
  const openNotes = () => {
    navigation.open(item.id, false, true);
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
            <TaskStatusPopup
              item={item}
              color={tree.colors.get(item.id) ?? "grey"}
              inherited={children.length > 0}
            />
            <div className="title-wrap">
              <TaskRowTitle item={item} data={data} select={select} />
              {hasMeaningfulNotes(item.description) && (
                <button
                  className="note-button"
                  title="Has Notes / Instructions"
                  aria-label={"Notes for " + item.summary}
                  onClick={openNotes}
                >
                  <NotesIcon />
                </button>
              )}
              <TaskAttachmentButton item={item} data={data} />
              <span className="row-id">
                {item.id.startsWith("local-") ? "New · Pending" : item.id}
                {data.operations.some((op) => {
                  return op.issueId === item.id;
                }) && <span className="pending-dot" title="Pending Changes" />}
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
