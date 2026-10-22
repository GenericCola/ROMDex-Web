import { workspaceStore } from "@/domain/workspace-store";
import { requireDelivery } from "./session";
import type { SharedStatusPreview } from "./shared-status-migration";
import {
  enableSharedChoices,
  localChoices,
  requireMigrationReady,
} from "./shared-status-migration";
export const previewSharedStatuses = async (): Promise<SharedStatusPreview> => {
  const port = requireDelivery(),
    { data } = workspaceStore.getSnapshot();
  requireMigrationReady(data);
  return {
    accountId: port.accountId,
    local: localChoices(data),
    items: await port.readShared(),
  };
};
export const enableSharedStatuses = async (
  preview: SharedStatusPreview,
  choice: "cloud" | "browser",
) => {
  const port = requireDelivery();
  if (port.accountId !== preview.accountId)
    throw Error("Reconnect the preview's account.");
  await workspaceStore.deliver(async (commit) => {
    await commit((data) => {
      enableSharedChoices(data, preview, choice);
    });
    port.enableShared();
  });
};
