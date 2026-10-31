import type { WorkspaceData } from "@/domain/types";

// The desktop Notes icon selects without reopening a minimized Details tray.
export const selectDetailView = (
  view: WorkspaceData["view"],
  id: string,
  notes = false,
) => {
  view.selected = id;
  if (!notes && view.detailsMode === "collapsed") view.detailsMode = "default";
  return notes && view.detailsMode !== "collapsed";
};
