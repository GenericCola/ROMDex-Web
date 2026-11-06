import { commitInlineTask, indentInlineTask } from "@/domain/task-inline";
import { taskTier } from "@/domain/task-presentation";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceTree } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Lamp from "./lamp";
import { useInlineAction } from "./use-inline-action";
import { useTaskTextEditing } from "./use-task-text-editing";
const NewItem = ({
  draft,
  data,
  items,
}: {
  draft: NonNullable<WorkspaceData["newTask"]>;
  data: WorkspaceData;
  items: TaskItem[];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const editing = useTaskTextEditing("new-task", "inline");
  const { run, error, busy } = useInlineAction();
  const tree = workspaceTree(items, data.order),
    depth = draft.parentId ? (tree.depths.get(draft.parentId) ?? 0) + 1 : 0;
  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, [draft.afterId, draft.parentId]);
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    if (!["Enter", "Tab", "Escape"].includes(event.key)) return;
    event.preventDefault();
    const outdent = event.shiftKey,
      action = event.key;
    run((next) => {
      if (action === "Enter") commitInlineTask(next);
      else if (action === "Tab") indentInlineTask(next, outdent);
      else {
        next.newTask = null;
        next.view.selected = null;
      }
    });
  };
  return (
    <tr
      className="draft-row"
      style={
        {
          "--depth": Math.max(
            0,
            depth -
              (data.view.scope
                ? (tree.depths.get(data.view.scope) ?? 0) + 1
                : 0),
          ),
        } as CSSProperties
      }
    >
      <td>
        <div className="task-cell">
          <span className="row-gutter" aria-hidden="true" />
          <div className="row-hierarchy">
            <span className="draft-indent" aria-hidden="true" />
            <span className="draft-status">
              <Lamp color="grey" />
            </span>
            <input
              ref={inputRef}
              id="draft-title"
              className="draft-input"
              aria-label={"New " + taskTier(depth) + " Title"}
              placeholder={taskTier(depth) + " Title…"}
              value={draft.title}
              readOnly={busy}
              onFocus={editing.focus}
              onInput={editing.activity}
              onBlur={editing.blur}
              onKeyDown={key}
              onChange={(event) => {
                const title = event.target.value;
                void workspaceStore.change((next) => {
                  if (next.newTask) next.newTask.title = title;
                });
              }}
            />
          </div>
        </div>
      </td>
      <td colSpan={3}>
        <span className="draft-hint">
          Enter to Add · Tab to Nest · Esc to Cancel
        </span>
        {error && <p role="alert">{error}</p>}
      </td>
    </tr>
  );
};
export default NewItem;
