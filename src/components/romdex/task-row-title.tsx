import { taskEditingLocked } from "@/domain/task-edit-lock";
import { itemName } from "@/domain/task-presentation";
import {
  beginInlineRename,
  commitInlineRename,
  indentInlineRename,
} from "@/domain/task-rename";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { useInlineAction } from "./use-inline-action";
import { useTaskTextEditing } from "./use-task-text-editing";
const TaskRowTitle = ({
  item,
  data,
  select,
}: {
  item: TaskItem;
  data: WorkspaceData;
  select: () => void;
}) => {
  const renaming = data.view.renameId === item.id;
  const inputRef = useRef<HTMLInputElement>(null),
    timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = useTaskTextEditing(item.id, "inline-title");
  const { run, error, busy } = useInlineAction();
  useLayoutEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  const rename = () => {
    if (taskEditingLocked(item.id)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    run((next) => {
      beginInlineRename(next, item.id);
    });
  };
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    const action = event.key,
      outdent = event.shiftKey;
    if (!["Enter", "Tab", "Escape"].includes(action)) return;
    event.preventDefault();
    run((next) => {
      if (action === "Enter") commitInlineRename(next, item.id);
      else if (action === "Tab") indentInlineRename(next, item.id, outdent);
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
          value={data.titleDrafts[item.id] ?? item.summary}
          readOnly={busy || taskEditingLocked(item.id)}
          onCompositionStart={editing.compositionStart}
          onCompositionEnd={editing.compositionEnd}
          onFocus={editing.focus}
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
            if (timerRef.current) clearTimeout(timerRef.current);
            if (event.detail > 1) return;
            if (event.detail === 0) select();
            else timerRef.current = setTimeout(select, 220);
          }}
        >
          {data.titleDrafts[item.id] ?? itemName(item)}
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
