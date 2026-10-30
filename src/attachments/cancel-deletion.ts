import { recordDelivery } from "@/cloud/journal";
import { cloudData } from "@/cloud/types";
import type { WorkspaceData } from "@/domain/types";
export const cancelUnsentAttachmentDeletion = (
  data: WorkspaceData,
  id: string,
) => {
  const operation = data.operations.find((entry) => {
    return entry.opId === id;
  });
  if (operation?.type !== "attachment-delete")
    throw Error("Attachment deletion is no longer pending.");
  if (cloudData(data).records[id])
    throw Error(
      "This deletion has delivery evidence. Review it before making another decision.",
    );
  data.operations = data.operations.filter((entry) => {
    return entry.opId !== id;
  });
  for (const ledger of Object.values(data.rdxImports ?? {})) {
    for (const batch of Object.values(ledger.batches)) {
      if (batch.opIds.includes(id)) batch.status = "needs-review";
    }
  }
  recordDelivery(data, id, {
    status: "confirmed",
    archivedOperation: operation,
    message:
      "Unsent attachment deletion explicitly cancelled. No remote deletion was sent.",
  });
};
