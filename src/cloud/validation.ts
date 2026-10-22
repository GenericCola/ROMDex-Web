import type { WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
const object = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
const text = (value: unknown) => {
  return typeof value === "string" && value.length > 0;
};
const invalid = () => {
  throw Error(
    "The cloud queue or delivery journal is invalid. Existing browser data has been kept. Delivery is blocked until repaired.",
  );
};
export const validateQueue = (data: WorkspaceData) => {
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
    switch (operation.type) {
      case "edit":
        if (
          !object(operation.base) ||
          operation.base.id !== operation.issueId ||
          !object(operation.patch)
        )
          invalid();
        validateTask(operation.base);
        for (const [key, value] of Object.entries(operation.patch)) {
          if (
            ![
              "summary",
              "description",
              "parentId",
              "state",
              "assignedState",
              "priority",
              "complexity",
            ].includes(key) ||
            !(
              typeof value === "string" ||
              (value === null && ["parentId", "complexity"].includes(key))
            ) ||
            (key === "summary" && !String(value).trim())
          )
            invalid();
        }
        break;
      case "comment":
        if (!text(operation.text) || !operation.text.trim()) invalid();
        break;
      case "create":
        if (!object(operation.item) || operation.item.id !== operation.issueId)
          invalid();
        validateTask(operation.item);
        break;
      case "delete":
        if (!Array.isArray(operation.ids) || !operation.ids.every(text))
          invalid();
        break;
      default:
        invalid();
    }
  }
  if (data.cloud === undefined) return;
  const { cloud } = data;
  if (
    !object(cloud) ||
    typeof cloud.autoSync !== "boolean" ||
    !object(cloud.records) ||
    (cloud.accountId !== undefined && !text(cloud.accountId))
  )
    invalid();
  for (const [id, record] of Object.entries(cloud.records)) {
    if (
      !object(record) ||
      !["attempting", "uncertain", "conflict", "confirmed"].includes(
        record.status,
      ) ||
      typeof record.message !== "string" ||
      !text(cloud.accountId) ||
      (record.remoteId !== undefined && !text(record.remoteId)) ||
      (record.status === "confirmed" ? ids.has(id) : !ids.has(id))
    )
      invalid();
  }
};
