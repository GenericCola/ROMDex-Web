import type { WorkspaceData } from "@/domain/types";
import {
  invalidQueue as invalid,
  queueObject as object,
  queueText as text,
} from "./queue-shape";
import { validateStatuses } from "./status-validation";
import { validateTagJournal } from "./tag-journal";
import { validateUnavailable } from "./unavailable-tasks";
import { validateOperation } from "./validate-operation";
export const validateQueue = (data: WorkspaceData) => {
  validateUnavailable(data);
  const ids = new Set<string>();
  for (const operation of data.operations) {
    if (
      !object(operation) ||
      !text(operation.opId) ||
      !text(operation.issueId) ||
      ids.has(operation.opId)
    )
      invalid();
    ids.add(operation.opId);
    validateOperation(operation);
  }
  if (data.cloud === undefined) {
    validateStatuses(data);
    return;
  }
  const { cloud } = data;
  if (
    !object(cloud) ||
    typeof cloud.autoSync !== "boolean" ||
    !object(cloud.records) ||
    (cloud.accountId !== undefined && !text(cloud.accountId))
  )
    invalid();
  validateStatuses(data);
  for (const [id, record] of Object.entries(cloud.records)) {
    if (!object(record)) invalid();
    const operation =
      data.operations.find((op) => {
        return op.opId === id;
      }) ?? record.archivedOperation;
    validateTagJournal(record, operation);
    if (
      record.attachmentBeforeIds !== undefined &&
      (!Array.isArray(record.attachmentBeforeIds) ||
        record.attachmentBeforeIds.length > 1000 ||
        record.attachmentBeforeIds.some((id) => {
          return !text(id);
        }) ||
        !operation ||
        !["attachment", "attachment-delete"].includes(operation.type))
    )
      invalid();
    if (record.status === "ready" && operation?.type !== "delete") invalid();
    if (
      [record.deletedIds, record.deleteReceipts, record.retiredIds].some(
        (entries) => {
          return (
            entries !== undefined &&
            (!Array.isArray(entries) ||
              operation?.type !== "delete" ||
              entries.some((entry) => {
                return !operation.ids.includes(entry);
              }))
          );
        },
      )
    )
      invalid();
    if (
      record.targetId !== undefined &&
      (typeof record.targetId !== "string" ||
        !operation ||
        (operation.type === "delete"
          ? !operation.ids.includes(record.targetId)
          : operation.issueId !== record.targetId))
    )
      invalid();
    if (
      !object(record) ||
      !["attempting", "uncertain", "conflict", "confirmed", "ready"].includes(
        record.status,
      ) ||
      typeof record.message !== "string" ||
      (record.status !== "confirmed" && !text(cloud.accountId)) ||
      (record.remoteId !== undefined && !text(record.remoteId)) ||
      (record.status === "confirmed" ? ids.has(id) : !ids.has(id)) ||
      [record.deletedIds, record.deleteReceipts, record.retiredIds].some(
        (entries) => {
          return (
            entries !== undefined &&
            (!Array.isArray(entries) || !entries.every(text))
          );
        },
      )
    )
      invalid();
  }
};
