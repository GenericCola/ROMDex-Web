import { trayLayout, trayPosition } from "./tray-layout";
import type { WorkspaceData } from "./types";
type View = WorkspaceData["view"];
// Desktop split-pane.mjs: arrows move 24px (80px with Shift), not a fixed percentage.
export const trayKey = (
  view: View,
  key: string,
  shift: boolean,
  height: number,
  measured?: ReturnType<typeof trayLayout>,
) => {
  if (
    !["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(key) ||
    height <= 10
  )
    return null;
  const layout = measured ?? trayLayout(view, height);
  const { available, minimum, work: current } = layout;
  if (key === "End")
    return { workHeight: view.workHeight, detailsMode: "collapsed" as const };
  if (key === "Enter" || key === " ")
    return {
      workHeight: view.workHeight,
      detailsMode:
        view.detailsMode === "collapsed"
          ? ("default" as const)
          : ("collapsed" as const),
    };
  const desired =
    key === "Home"
      ? minimum
      : current + (key === "ArrowUp" ? -1 : 1) * (shift ? 80 : 24);
  if (key === "ArrowDown" && desired >= available - 24)
    return { workHeight: view.workHeight, detailsMode: "collapsed" as const };
  return trayPosition(view, layout, desired, false);
};
