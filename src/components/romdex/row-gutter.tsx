import { taskEditingLocked } from "@/domain/task-edit-lock";
import { moveSibling } from "@/domain/task-layout";
import type { SelectionModifiers } from "@/domain/work-selection";
import { useState } from "react";
import TaskMoveDialog from "./task-move-dialog";
import { useInlineAction } from "./use-inline-action";
const RowGutter = ({
  id,
  summary,
  checked,
  disabled,
  choose,
}: {
  id: string;
  summary: string;
  checked: boolean;
  disabled: boolean;
  choose: (id: string, modifiers: SelectionModifiers) => void;
}) => {
  const work = useInlineAction();
  const [moving, setMoving] = useState(false);
  return (
    <div className="row-gutter">
      <button
        className="grip"
        data-drag={id}
        aria-label={"Drag " + summary}
        aria-haspopup="dialog"
        aria-description="Drag to reorder, or click or press Enter to choose an exact destination."
        title="Drag to Move · Click or Enter for Exact Destination · Alt+Arrow Up/Down to Reorder"
        onClick={() => {
          return setMoving(true);
        }}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        disabled={disabled || work.busy || taskEditingLocked(id)}
        onKeyDown={(event) => {
          if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key))
            return;
          event.preventDefault();
          event.stopPropagation();
          const direction = event.key === "ArrowUp" ? -1 : 1;
          work.run((next) => {
            moveSibling(next, id, direction);
          });
        }}
        style={{ touchAction: "pan-y" }}
      >
        ⠿
      </button>
      {moving && (
        <TaskMoveDialog
          id={id}
          summary={summary}
          close={() => {
            return setMoving(false);
          }}
        />
      )}
      {work.error && <span role="alert">{work.error}</span>}
      <input
        type="checkbox"
        className="row-check"
        aria-label={"Select " + summary}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          const native = event.nativeEvent as MouseEvent;
          choose(id, {
            shiftKey: native.shiftKey,
            ctrlKey: native.ctrlKey,
            metaKey: native.metaKey,
          });
        }}
      />
    </div>
  );
};
export default RowGutter;
