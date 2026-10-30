import { materialize } from "./accepted/core.mjs";
import { flushDraftEditors } from "./editor-drafts";
import { revealDropParent } from "./reveal-drop-parent";
import { applyTaskDrop, type DropIntent } from "./task-drop";
import { workspaceStore } from "./workspace-store";
import { trackWorkspaceWork } from "./workspace-work";
export const commitTaskDrop = (
  intent: DropIntent,
  signature: string,
  current: () => boolean,
) => {
  return trackWorkspaceWork(async () => {
    await flushDraftEditors();
    if (!current()) throw Error("The workspace changed. Move cancelled.");
    await workspaceStore.change((data) => {
      applyTaskDrop(data, intent, signature);
      const moved = materialize(data.remote, data.operations).find((item) => {
        return item.id === intent.dragId;
      });
      if (moved) revealDropParent(data, moved.parentId);
    });
    await workspaceStore.flush();
  });
};
