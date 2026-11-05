import { operationTicketIds } from "./operation-tickets";
import type { WorkspaceData } from "./types";
// New bytes may be kept locally while uploads wait; delivery still holds the ticket.
export const canStageAlongsideUploads = (data: WorkspaceData, id: string) => {
  const operations = data.operations.filter((op) => {
    return operationTicketIds(op).has(id);
  });
  return (
    operations.length > 0 &&
    operations.every((op) => {
      return op.type === "attachment";
    }) &&
    Object.entries(data.cloud?.records ?? {}).every(([key, record]) => {
      return (
        record.status === "confirmed" ||
        data.operations.some((op) => {
          return op.opId === key;
        })
      );
    })
  );
};

export const independentUploadChange = (
  before: WorkspaceData,
  after: WorkspaceData,
  operation: import("./types").TaskOperation,
  allowUnsentUploadCancellation: boolean,
) => {
  if (
    allowUnsentUploadCancellation &&
    operation.type === "attachment" &&
    !before.cloud?.records[operation.opId] &&
    !after.operations.some((op) => {
      return op.opId === operation.opId;
    }) &&
    canStageAlongsideUploads(before, operation.issueId) &&
    after.cloud?.records[operation.opId]?.status === "confirmed" &&
    JSON.stringify(after.cloud.records[operation.opId]?.archivedOperation) ===
      JSON.stringify(operation)
  )
    return true;
  if (
    operation.type === "attachment" &&
    !before.operations.some((op) => {
      return op.opId === operation.opId;
    }) &&
    !after.cloud?.records[operation.opId] &&
    canStageAlongsideUploads(before, operation.issueId)
  )
    return true;
  return false;
};
