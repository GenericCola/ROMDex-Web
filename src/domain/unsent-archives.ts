import type { TaskOperation, WorkspaceData } from "./types";
import { canStageAlongsideUploads } from "./upload-staging";
// Project only proven local cancellation receipts out of the metadata comparison.
// Existing journal entries and all other metadata remain subject to exact checks.
export const withoutUnsentArchives = (
  before: WorkspaceData,
  after: WorkspaceData,
  locked: Set<string>,
  ticketIds: (operation: TaskOperation) => Set<string>,
  allowUnsentUploadCancellation = false,
): WorkspaceData => {
  if (!after.cloud) return after;
  const records = { ...after.cloud.records };
  for (const [id, record] of Object.entries(records)) {
    if (Object.hasOwn(before.cloud?.records ?? {}, id)) continue;
    const prior = before.operations.filter((operation) => {
      return operation.opId === id;
    });
    const operation = prior[0];
    if (
      prior.length !== 1 ||
      !operation ||
      record?.status !== "confirmed" ||
      typeof record.message !== "string" ||
      Object.keys(record).some((key) => {
        return !["status", "message", "archivedOperation"].includes(key);
      }) ||
      JSON.stringify(record.archivedOperation) !== JSON.stringify(operation) ||
      after.operations.some((next) => {
        return next.opId === id;
      }) ||
      [...ticketIds(operation)].some((ticket) => {
        return (
          locked.has(ticket) &&
          !(
            allowUnsentUploadCancellation &&
            operation.type === "attachment" &&
            canStageAlongsideUploads(before, ticket)
          )
        );
      })
    )
      continue;
    delete records[id];
  }
  return { ...after, cloud: { ...after.cloud, records } };
};
