import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { adoptTasks } from "./assigned-status";
import { recordDelivery } from "./journal";
import { cloudData } from "./types";
export interface SharedStatusPreview {
  accountId: string;
  items: TaskItem[];
  local: Record<string, string>;
}
export const requireMigrationReady = (data: WorkspaceData) => {
  if (
    cloudData(data).sharedStatuses ||
    data.operations.length ||
    cloudData(data).rollupPending ||
    Object.values(cloudData(data).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error(
      "Save or review pending changes before enabling shared status.",
    );
};
export const localChoices = (data: WorkspaceData) => {
  return Object.fromEntries(
    data.remote.map((item) => {
      return [
        item.id,
        cloudData(data).assigned?.[item.id]?.assignedState ??
          item.assignedState ??
          item.state,
      ];
    }),
  );
};
export const enableSharedChoices = (
  data: WorkspaceData,
  preview: SharedStatusPreview,
  choice: "cloud" | "browser",
) => {
  requireMigrationReady(data);
  if (
    !cloudData(data).accountId ||
    cloudData(data).accountId !== preview.accountId
  )
    throw Error("The preview belongs to a different account.");
  const current = localChoices(data),
    ids = new Set(
      preview.items.map((item) => {
        return item.id;
      }),
    );
  if (
    ids.size !== preview.items.length ||
    data.remote.some((item) => {
      return !ids.has(item.id) || current[item.id] !== preview.local[item.id];
    })
  )
    throw Error("The browser workspace changed. Preview shared status again.");
  for (const item of preview.items) {
    validateTask(item);
    if (
      item.sharedStatus?.state !== item.state ||
      item.sharedStatus.updated !== item.updated ||
      (item.parentId && !ids.has(item.parentId))
    )
      throw Error(
        "Shared status or hierarchy is incomplete. Nothing was changed.",
      );
  }
  indexTree(preview.items);
  data.cloud = {
    ...cloudData(data),
    sharedStatuses: true,
    rollupPending: true,
  };
  adoptTasks(data, preview.items);
  for (const item of preview.items) {
    const local = preview.local[item.id];
    if (local === undefined || local === item.assignedState) continue;
    const operation = {
      opId: crypto.randomUUID(),
      type: "edit" as const,
      issueId: item.id,
      base: structuredClone(item),
      patch: { assignedState: local },
    };
    if (choice === "browser") data.operations.push(operation);
    else
      recordDelivery(data, operation.opId, {
        status: "confirmed",
        message:
          "Browser assignment archived before adopting the previewed YouTrack choice.",
        archivedOperation: operation,
      });
  }
};
