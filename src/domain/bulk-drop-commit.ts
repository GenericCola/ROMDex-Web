import { materialize } from "./accepted/core.mjs";
import { stageMove } from "./bulk-hierarchy";
import { flushDraftEditors } from "./editor-drafts";
import { rowDropTarget, type DropIntent } from "./task-drop";
import { workspaceStore } from "./workspace-store";
import { trackWorkspaceWork } from "./workspace-work";
export const commitBulkTaskDrop = (
  ids: string[],
  intent: DropIntent,
  signature: string,
  current: () => boolean,
) => {
  return trackWorkspaceWork(async () => {
    await flushDraftEditors();
    if (!current()) throw Error("The workspace changed. Move cancelled.");
    await workspaceStore.change((data) => {
      const target = rowDropTarget(
        materialize(data.remote, data.operations),
        data.order,
        intent,
        [],
      );
      if (!target) throw Error("The destination is no longer available.");
      stageMove(data, ids, target.parentId, target.beforeId, signature);
    });
    await workspaceStore.flush();
  });
};
