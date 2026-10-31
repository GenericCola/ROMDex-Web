import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
let savingDrafts: Promise<void> | undefined;
export const saveLocalDrafts = async () => {
  const alreadyDelivering = workspaceStore.getSnapshot().delivering;
  savingDrafts ??= flushDraftEditors().finally(() => {
    savingDrafts = undefined;
  });
  await savingDrafts;
  return alreadyDelivering;
};
export const finishLocalSave = async (disconnected = false) => {
  await workspaceStore.flush();
  if (disconnected)
    return "Saved in this browser. Connect cloud delivery to send queued changes.";
  return workspaceStore.getSnapshot().delivering
    ? "Saved in this browser. The current background delivery continues; additional changes remain queued."
    : "Saved in this browser. Additional changes remain queued for the next delivery.";
};
