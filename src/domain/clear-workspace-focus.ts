import { editTask } from "./task-actions";
import type { WorkspaceData } from "./types";
import { findWorkspaceItem } from "./workspace-item";
// Desktop Escape flushes a valid Details title but cancels inline naming.
export const clearWorkspaceFocus = (data: WorkspaceData) => {
  const { selected } = data.view;
  if (
    selected &&
    selected !== data.view.renameId &&
    Object.hasOwn(data.titleDrafts, selected)
  ) {
    const title = data.titleDrafts[selected]?.trim();
    const item = findWorkspaceItem(data, selected);
    if (title && item && item.summary !== title)
      editTask(data, selected, { summary: title });
    delete data.titleDrafts[selected];
  }
  if (data.view.renameId) delete data.titleDrafts[data.view.renameId];
  data.view.renameId = null;
  data.newTask = null;
  data.view.selected = null;
};
