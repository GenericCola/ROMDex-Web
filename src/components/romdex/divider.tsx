import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { KeyboardEvent, PointerEvent } from "react";
import { useRef } from "react";
const Divider = ({ view }: { view: WorkspaceData["view"] }) => {
  const pointerRef = useRef<number | null>(null);
  const setHeight = (height: number) => {
    void workspaceStore.change((data) => {
      data.view.workHeight = Math.max(10, Math.min(90, height));
      data.view.detailsMode = height > 94 ? "collapsed" : "default";
    });
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) setHeight(((event.clientY - bounds.top) / bounds.height) * 100);
  };
  const up = () => {
    pointerRef.current = null;
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 3;
    if (
      ["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(event.key)
    )
      event.preventDefault();
    if (event.key === "ArrowUp") setHeight(view.workHeight - step);
    if (event.key === "ArrowDown") setHeight(view.workHeight + step);
    if (event.key === "Home") setHeight(10);
    if (event.key === "End") setHeight(100);
    if (event.key === "Enter" || event.key === " ")
      setHeight(view.detailsMode === "collapsed" ? 46 : 100);
  };
  return (
    <div
      id="pane-divider"
      className="pane-divider"
      role="separator"
      tabIndex={0}
      aria-label="Resize Work and Details Trays"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={view.detailsMode === "collapsed" ? 100 : view.workHeight}
      onKeyDown={keys}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span className="split-grip" aria-hidden="true" />
    </div>
  );
};
export default Divider;
