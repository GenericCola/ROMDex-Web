import { trayPosition } from "@/domain/tray-layout";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef, type PointerEvent } from "react";
import { measureTray } from "./tray-measurement";
export const useDividerPointer = () => {
  const activeRef = useRef<{
    id: number;
    offset: number;
    initial: WorkspaceData["view"];
    handle: HTMLDivElement;
  } | null>(null);
  const finish = (cancel = false) => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    if (active.handle.hasPointerCapture(active.id))
      active.handle.releasePointerCapture(active.id);
    active.handle.closest(".romdex-app")?.classList.remove("pane-resizing");
    if (cancel)
      void workspaceStore.change((data) => {
        data.view.workHeight = active.initial.workHeight;
        data.view.detailsMode = active.initial.detailsMode;
        if (active.initial.automaticTrayHeight === undefined)
          delete data.view.automaticTrayHeight;
        else data.view.automaticTrayHeight = active.initial.automaticTrayHeight;
      });
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeRef.current) return;
      event.preventDefault();
      finish(true);
    };
    const blur = () => {
      finish(true);
    };
    document.addEventListener("keydown", escape);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", escape);
      window.removeEventListener("blur", blur);
      finish(true);
    };
  }, []);
  const down = (event: PointerEvent<HTMLDivElement>) => {
    const host = event.currentTarget.parentElement;
    if (event.button !== 0 || activeRef.current || !host) return;
    event.preventDefault();
    event.stopPropagation();
    const initial = structuredClone(workspaceStore.getSnapshot().data.view);
    activeRef.current = {
      id: event.pointerId,
      initial,
      handle: event.currentTarget,
      offset:
        event.clientY -
        host.getBoundingClientRect().top -
        measureTray(host, initial).work,
    };
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.closest(".romdex-app")?.classList.add("pane-resizing");
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = activeRef.current,
      host = event.currentTarget.parentElement;
    if (active?.id !== event.pointerId || !host) return;
    event.preventDefault();
    event.stopPropagation();
    const { view } = workspaceStore.getSnapshot().data;
    const next = trayPosition(
      view,
      measureTray(host, view),
      event.clientY - host.getBoundingClientRect().top - active.offset,
    );
    void workspaceStore.change((data) => {
      Object.assign(data.view, next);
    });
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (activeRef.current?.id !== event.pointerId) return;
    finish();
  };
  const cancel = (event: PointerEvent<HTMLDivElement>) => {
    if (activeRef.current?.id !== event.pointerId) return;
    finish(true);
  };
  return { down, move, up, cancel };
};
