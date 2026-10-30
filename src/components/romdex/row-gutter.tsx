import { moveSibling } from "@/domain/task-layout";
import type { SelectionModifiers } from "@/domain/work-selection";
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
  return (
    <div className="row-gutter">
      <button
        className="grip"
        data-drag={id}
        aria-label={"Drag " + summary}
        title="Drag to Reorder or Change Parent · Alt+Arrow Up/Down to Reorder"
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        disabled={disabled || work.busy}
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
        style={{ touchAction: "none" }}
      >
        ⠿
      </button>
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
