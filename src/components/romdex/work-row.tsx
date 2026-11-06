import { hasMeaningfulNotes } from "@/domain/accepted/core.mjs";
import type { LampColor, TaskItem } from "@/domain/types";
import type { SelectionModifiers } from "@/domain/work-selection";
import { memo, type CSSProperties } from "react";
import { useDetailNavigation } from "./detail-navigation-context";
import NotesIcon from "./notes-icon";
import { rowClassName } from "./row-class";
import RowGutter from "./row-gutter";
import { toggleExpanded } from "./row-toggle";
import TaskAttachmentButton from "./task-attachment-button";
import TaskField from "./task-field";
import TaskRowActions from "./task-row-actions";
import TaskRowTitle from "./task-row-title";
import TaskStatusPopup from "./task-status-popup";
const WorkRowView = ({
  item,
  depth,
  hasChildren,
  color,
  expanded,
  selected,
  renaming,
  titleDraft,
  pending,
  attachmentCount,
  add,
  checked,
  selectionDisabled,
  choose,
  dragging = false,
  drop = null,
}: {
  item: TaskItem;
  depth: number;
  hasChildren: boolean;
  color: LampColor;
  expanded: boolean;
  selected: boolean;
  renaming: boolean;
  titleDraft: string | undefined;
  pending: boolean;
  attachmentCount: number;
  // Not read here: changing it re-renders rows whose children read global lock state.
  lockKey: string;
  add: (parentId: string | null) => void;
  checked: boolean;
  selectionDisabled: boolean;
  choose: (id: string, modifiers: SelectionModifiers) => void;
  dragging?: boolean;
  drop?: "before" | "after" | null;
}) => {
  const navigation = useDetailNavigation();
  const select = () => {
    navigation.open(item.id);
  };
  const openNotes = () => {
    navigation.open(item.id, false, true);
  };
  const toggle = () => {
    toggleExpanded(item.id, expanded);
  };
  return (
    <tr
      className={rowClassName({
        dragging,
        drop,
        hasChildren,
        highlighted: selected || checked,
      })}
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
            {hasChildren ? (
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
              color={color}
              inherited={hasChildren}
            />
            <div className="title-wrap">
              <TaskRowTitle
                item={item}
                renaming={renaming}
                titleDraft={titleDraft}
                select={select}
              />
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
              <TaskAttachmentButton item={item} count={attachmentCount} />
              <span className="row-id">
                {item.id.startsWith("local-") ? "New · Pending" : item.id}
                {pending && (
                  <span className="pending-dot" title="Pending Changes" />
                )}
              </span>
            </div>
            {!!item.dependencies && (
              <span className="dependency-count" title="Linked Issues">
                ♧ {item.dependencies}
              </span>
            )}
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
        <TaskRowActions item={item} add={add} />
      </td>
    </tr>
  );
};
const WorkRow = memo(WorkRowView);
export default WorkRow;
