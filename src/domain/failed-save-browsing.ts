import type { WorkspaceData } from "./types";
/**
 * Browsing is session-only while saving is unavailable. Never change the
 * queued operations, journal, drafts, or revision to make navigation work.
 */
export const assertBrowseOnly = (
  previous: WorkspaceData,
  next: WorkspaceData,
  error: string,
) => {
  const unchanged =
    JSON.stringify({ ...next, view: null }) ===
    JSON.stringify({ ...previous, view: null });
  const moved = JSON.stringify(next.view) !== JSON.stringify(previous.view);
  if (!unchanged || !moved) throw Error(error);
};
