import { trayKey } from "@/domain/tray-keyboard";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { KeyboardEvent } from "react";
import { measureTray } from "./tray-measurement";
import { useDividerMetrics } from "./use-divider-metrics";
import { useDividerPointer } from "./use-divider-pointer";
const Divider = ({ view }: { view: WorkspaceData["view"] }) => {
  const { ref, percent, text } = useDividerMetrics(view);
  const { down, move, up, cancel } = useDividerPointer();
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    const host = event.currentTarget.parentElement;
    const next = trayKey(
      view,
      event.key,
      event.shiftKey,
      host?.getBoundingClientRect().height ?? 0,
      host ? measureTray(host, view) : undefined,
    );
    if (!next) return;
    event.preventDefault();
    void workspaceStore.change((data) => {
      Object.assign(data.view, next);
    });
  };
  return (
    <div
      ref={ref}
      id="pane-divider"
      className="pane-divider"
      role="separator"
      tabIndex={0}
      aria-label="Resize Work and Details Trays"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={text}
      onKeyDown={keys}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <span className="split-grip" aria-hidden="true" />
    </div>
  );
};
export default Divider;
