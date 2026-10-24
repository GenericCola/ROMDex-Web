import type { TaskOperation } from "@/domain/types";
import type { ChangeEventHandler } from "react";
const DeliveryReceipt = ({
  type,
  value,
  change,
}: {
  type: TaskOperation["type"] | undefined;
  value: string;
  change: ChangeEventHandler<HTMLInputElement>;
}) => {
  const label =
    type === "create"
      ? "Exact created issue ID (PMON-number)"
      : type === "comment"
        ? "Exact comment ID, if needed"
        : type === "attachment"
          ? "Exact attachment ID, if needed"
          : "";
  return label ? (
    <label>
      {label}
      <input value={value} onChange={change} />
    </label>
  ) : null;
};
export default DeliveryReceipt;

export const StopDeliveryLabel = ({
  type,
}: {
  type: TaskOperation["type"] | undefined;
}) => {
  switch (type) {
    case "create":
      return "Stop creation and dependent changes; archive";
    case "delete":
      return "Stop remaining deletions; archive";
    case "attachment":
      return "Stop upload; archive pending file";
    case "attachment-delete":
      return "Stop attachment deletion; archive";
    default:
      return "Keep YouTrack; archive pending change";
  }
};
