import type { TaskOperation } from "@/domain/types";
import type { DeliveryRecord } from "./types";
export const validateLocalFileReview = (
  record: DeliveryRecord,
  operation: TaskOperation | undefined,
) => {
  if (record.localFileState === undefined) return;
  if (
    operation?.type !== "attachment" ||
    !(
      (record.localFileState === "missing" && record.status === "conflict") ||
      (record.localFileState === "restored" && record.status === "ready")
    ) ||
    Object.keys(record).some((key) => {
      return !["status", "message", "localFileState"].includes(key);
    })
  )
    throw Error("Invalid local file recovery record.");
};
