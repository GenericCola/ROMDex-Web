import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { flushWorkspaceWork } from "@/domain/workspace-work";
export const flushLocal = async () => {
  if (workspaceStore.getSnapshot().delivering)
    throw Error("Finish delivery before switching projects or signing out.");
  await flushDraftEditors();
  await flushWorkspaceWork();
  if (workspaceStore.getSnapshot().delivering)
    throw Error("Finish delivery before switching projects or signing out.");
  if (workspaceStore.getSnapshot().ready) await workspaceStore.flush();
};
