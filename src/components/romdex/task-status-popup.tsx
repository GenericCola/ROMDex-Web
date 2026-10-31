import { STATUS, statusOf } from "@/domain/accepted/core.mjs";
import { assignTaskStatus } from "@/domain/assigned-status";
import { taskEditingLocked } from "@/domain/task-edit-lock";
import { setTaskTextEditing } from "@/domain/task-editing";
import { itemName } from "@/domain/task-presentation";
import type { LampColor, TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useState } from "react";
import Dialog from "./dialog";
import Lamp from "./lamp";
import { useAttachmentWork } from "./use-attachment-work";
import { useFreshTask } from "./use-fresh-task";

const TaskStatusPopup = ({
  item,
  color,
  inherited,
  compact = true,
}: {
  item: TaskItem;
  color: LampColor;
  inherited: boolean;
  compact?: boolean;
}) => {
  const fresh = useFreshTask(item.id);
  const [base, setBase] = useState<string | null>(null);
  const { busy, message, setMessage, run } = useAttachmentWork();
  const open = () => {
    setMessage("");
    fresh.open((current) => {
      setBase(current.assignedState ?? current.state);
    });
  };
  useEffect(() => {
    const key = item.id + ":status";
    setTaskTextEditing(key, base !== null);
    return () => {
      setTaskTextEditing(key, false);
    };
  }, [item.id, base]);
  const close = () => {
    if (!busy) setBase(null);
  };
  const option = (optionColor: LampColor) => {
    const choose = () => {
      if (base === null) return;
      run(async () => {
        await workspaceStore.change((data) => {
          assignTaskStatus(data, item.id, optionColor, base);
        });
        await workspaceStore.flush();
        setBase(null);
      });
    };
    return (
      <button
        key={optionColor}
        aria-label={STATUS[optionColor]}
        disabled={busy}
        aria-pressed={base !== null && statusOf(base) === optionColor}
        onClick={choose}
      >
        <Lamp color={optionColor} /> {STATUS[optionColor]}
      </button>
    );
  };
  return (
    <>
      <button
        className={
          "status-button" +
          (compact ? " row-status" : "") +
          (inherited ? " inherited" : "")
        }
        aria-label={"Set Status for " + item.summary}
        title={
          (inherited ? "Inherited from Children: " : "") +
          STATUS[color] +
          " · Click to Set Assigned Status"
        }
        disabled={taskEditingLocked(item.id) || fresh.checking}
        onClick={open}
      >
        <Lamp color={color} />
        <span className={compact ? "sr-only" : ""}>{STATUS[color]}</span>
      </button>
      {fresh.error && <p role="status">{fresh.error}</p>}
      {base !== null && (
        <Dialog title="Set Status" close={close} canClose={!busy} desktop>
          <p className="muted">
            {itemName(item)}
            {inherited
              ? " · Displayed status is inherited from children. Assigned: " +
                base +
                ". This value appears when the item has no children."
              : ""}
          </p>
          <div className="status-options">
            {(Object.keys(STATUS) as LampColor[]).map(option)}
          </div>
          <p role="status">{message}</p>
        </Dialog>
      )}
    </>
  );
};
export default TaskStatusPopup;
