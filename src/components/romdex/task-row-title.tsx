import { taskEditingLocked } from "@/domain/task-edit-lock";
import { setTaskTextEditing } from "@/domain/task-editing";
import { itemName } from "@/domain/task-presentation";
import {
  beginInlineRename,
  commitInlineRename,
  indentInlineRename,
} from "@/domain/task-rename";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { inlineTitleKey } from "./inline-title-key";
import { useDelayedRowOpen } from "./use-delayed-row-open";
import { useInlineAction } from "./use-inline-action";
import { useTaskTextEditing } from "./use-task-text-editing";
const TaskRowTitle = ({
  item,
  renaming,
  titleDraft,
  select,
}: {
  item: TaskItem;
  renaming: boolean;
  titleDraft: string | undefined;
  select: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const delayed = useDelayedRowOpen(select);
  const editing = useTaskTextEditing(item.id, "inline-title");
  const { run, queue, error, busy } = useInlineAction();
  useLayoutEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else setTaskTextEditing(item.id + ":inline-title", false);
  }, [renaming, item.id]);
  const rename = () => {
    if (taskEditingLocked(item.id)) return;
    delayed.cancel();
    run((next) => {
      beginInlineRename(next, item.id);
    });
  };
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    const press = inlineTitleKey(event);
    if (!press) return;
    queue((next) => {
      if (press.action === "Enter") commitInlineRename(next, item.id);
      else if (press.action === "Tab")
        indentInlineRename(next, item.id, press.outdent);
      else if (next.view.renameId === item.id) {
        delete next.titleDrafts[item.id];
        next.view.renameId = null;
        next.view.selected = null;
      }
    });
  };
  return (
    <>
      {renaming ? (
        <input
          ref={inputRef}
          id="rename-input"
          className="draft-input"
          aria-label="Rename Task"
          value={titleDraft ?? item.summary}
          readOnly={busy || taskEditingLocked(item.id)}
          onCompositionStart={editing.compositionStart}
          onCompositionEnd={editing.compositionEnd}
          onFocus={editing.focus}
          onInput={editing.activity}
          onBlur={editing.blur}
          onKeyDown={key}
          onChange={(event) => {
            const title = event.target.value;
            void workspaceStore.change((next) => {
              if (next.view.renameId === item.id)
                next.titleDrafts[item.id] = title;
            });
          }}
        />
      ) : (
        <button
          className="row-title"
          data-drag={item.id}
          title={item.summary}
          onDoubleClick={rename}
          onKeyDown={(event) => {
            if (
              event.key === "F2" &&
              !event.ctrlKey &&
              !event.altKey &&
              !event.metaKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              rename();
            }
          }}
          onClick={(event) => {
            delayed.cancel();
            if (event.detail > 1) return;
            if (event.detail === 0) select();
            else delayed.schedule();
          }}
        >
          {titleDraft ?? itemName(item)}
        </button>
      )}
      {error && (
        <span role="alert" className="port-error">
          {error}
        </span>
      )}
    </>
  );
};
export default TaskRowTitle;
