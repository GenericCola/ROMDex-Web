import { STATUS, statusOf } from "@/domain/accepted/core.mjs";
import { assignTaskStatus } from "@/domain/assigned-status";
import { itemName } from "@/domain/task-presentation";
import type { LampColor, TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import Dialog from "./dialog";
import Lamp from "./lamp";
import { useAttachmentWork } from "./use-attachment-work";

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
  const [base, setBase] = useState<string | null>(null);
  const { busy, message, setMessage, run } = useAttachmentWork();
  const open = () => {
    setMessage("");
    setBase(item.assignedState ?? item.state);
  };
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
        onClick={open}
      >
        <Lamp color={color} />
        <span className={compact ? "sr-only" : ""}>{STATUS[color]}</span>
      </button>
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
