import type { WorkspaceData } from "./types";
export const defaultTrayHeight = (
  hostHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) => {
  return viewportWidth <= 700
    ? Math.max(180, viewportHeight * 0.35)
    : hostHeight -
        Math.max(
          viewportWidth <= 1000 ? 270 : 235,
          viewportHeight * (viewportWidth <= 1000 ? 0.39 : 0.34),
        ) -
        124;
};
// Desktop split-pane.mjs at 28c0ce4d: preserve measured minimum and 96px Details.
export const trayLayout = (
  view: WorkspaceData["view"],
  height: number,
  minWork = 240,
  defaultWorkHeight?: number,
) => {
  const available = Math.max(0, height - 10);
  const minimum = Math.min(minWork, available * 0.6);
  const maximum = Math.max(minimum, available - Math.min(96, available * 0.25));
  const work =
    view.detailsMode === "collapsed"
      ? available
      : Math.max(
          minimum,
          Math.min(
            maximum,
            view.automaticTrayHeight && defaultWorkHeight !== undefined
              ? defaultWorkHeight
              : (view.workHeight / 100) * available,
          ),
        );
  return { available, minimum, maximum, work };
};
export const trayPosition = (
  view: WorkspaceData["view"],
  layout: ReturnType<typeof trayLayout>,
  desired: number,
  collapse = true,
) => {
  if (collapse && desired >= layout.available - 24)
    return { workHeight: view.workHeight, detailsMode: "collapsed" as const };
  return {
    automaticTrayHeight: false,
    workHeight: layout.available
      ? (Math.max(layout.minimum, Math.min(layout.maximum, desired)) /
          layout.available) *
        100
      : 0,
    detailsMode: "default" as const,
  };
};
