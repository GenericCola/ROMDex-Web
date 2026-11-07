import { commitInlineTask, indentInlineTask } from "@/domain/task-inline";
import { taskTier } from "@/domain/task-presentation";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceTree } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import DraftRow from "./draft-row";
import { inlineTitleKey } from "./inline-title-key";
import { useInlineAction } from "./use-inline-action";
import { useTaskTextEditing } from "./use-task-text-editing";
const NewItem = ({
  draft,
  data,
  items,
  rowIndex,
}: {
  draft: NonNullable<WorkspaceData["newTask"]>;
  rowIndex: number;
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
    const press = inlineTitleKey(event);
    if (!press) return;
    run((next) => {
      if (press.action === "Enter") commitInlineTask(next);
      else if (press.action === "Tab") indentInlineTask(next, press.outdent);
      else {
        next.newTask = null;
        next.view.selected = null;
      }
    });
  };
  return (
    <DraftRow
      decorative
      rowIndex={rowIndex}
      depth={Math.max(
        0,
        depth -
          (data.view.scope ? (tree.depths.get(data.view.scope) ?? 0) + 1 : 0),
      )}
      input={
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
      }
    >
      <td colSpan={3}>
        <span className="draft-hint">
          Enter to Add · Tab to Nest · Esc to Cancel
        </span>
        {error && <p role="alert">{error}</p>}
      </td>
    </DraftRow>
  );
};
export default NewItem;
