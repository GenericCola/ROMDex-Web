import { flushDraftEditors, hasDraftEdits } from "./editor-drafts";
import type { WorkspaceData, WorkspaceSnapshot } from "./types";
import { flushWorkspaceWork, hasWorkspaceWork } from "./workspace-work";
export interface WorkspacePersistence {
  load: () => Promise<{ revision: number; data: WorkspaceData } | undefined>;
  save: (data: WorkspaceData, expectedRevision: number) => Promise<number>;
}
export const prepareWorkspaceUpdate = async (
  store: { getSnapshot: () => WorkspaceSnapshot; flush: () => Promise<void> },
  setUpdating: (updating: boolean) => void,
  switching: () => boolean,
) => {
  if (switching()) throw Error("Wait for workspace switching to finish.");
  if (hasDraftEdits()) await flushDraftEditors();
  if (hasWorkspaceWork()) await flushWorkspaceWork();
  if (store.getSnapshot().delivering || switching())
    throw Error("Wait for delivery or workspace switching before updating.");
  setUpdating(true);
  const release = () => {
    setUpdating(false);
  };
  try {
    await store.flush();
    return release;
  } catch (error) {
    release();
    throw error;
  }
};
