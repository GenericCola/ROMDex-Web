import type { DropTarget } from "@/domain/task-drop";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { finishTaskDrag } from "./task-drag-finish";
import { refreshTaskDrag, scrollTaskDrag } from "./task-drag-navigation";
import type { DragPoint } from "./task-drag-preview";
import { startTaskDrag } from "./task-drag-start";
import type { Drag } from "./task-drag-state";
export const useTaskDrag = (
  selectedIds: string[] = [],
  clearSelection?: () => void,
) => {
  const dragRef = useRef<Drag | null>(null),
    mountedRef = useRef(true),
    suppressClickUntilRef = useRef(0);
  const pointRef = useRef<DragPoint | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoverRef = useRef<{ id: string; since: number } | null>(null);
  const [preview, setPreview] = useState<DropTarget | null>(null);
  const [message, setMessage] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const cancel = () => {
    if (dragRef.current?.active)
      suppressClickUntilRef.current = Date.now() + 350;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    pointRef.current = null;
    hoverRef.current = null;
    const capture = dragRef.current?.capture;
    if (capture?.hasPointerCapture?.(dragRef.current?.pointer ?? -1))
      capture.releasePointerCapture(dragRef.current?.pointer ?? -1);
    dragRef.current = null;
    setPreview(null);
    setDragId(null);
  };
  const down = (event: PointerEvent<HTMLElement>) => {
    try {
      dragRef.current = startTaskDrag(event, selectedIds);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Move unavailable.");
    }
  };
  const refresh = (point: DragPoint, current: Drag) => {
    refreshTaskDrag(
      point,
      current,
      hoverRef,
      setPreview,
      setMessage,
      mountedRef,
    );
  };
  const tick = () => {
    const point = pointRef.current;
    const { current } = dragRef;
    if (point && current?.active && (scrollTaskDrag(point) || hoverRef.current))
      refresh(point, current);
  };
  useEffect(() => {
    mountedRef.current = true;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Shift" &&
        pointRef.current &&
        dragRef.current?.active
      ) {
        pointRef.current.shiftKey = event.shiftKey;
        refresh(pointRef.current, dragRef.current);
      }
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault();
        cancel();
        setMessage("Move cancelled.");
      }
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("keyup", escape);
    window.addEventListener("blur", cancel);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      dragRef.current = null;
      window.removeEventListener("keydown", escape);
      window.removeEventListener("keyup", escape);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const move = (event: PointerEvent<HTMLElement>) => {
    const { current } = dragRef;
    if (current?.pointer !== event.pointerId) return;
    if (
      !current.active &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6
    )
      return;
    current.active = true;
    setDragId(current.id);
    event.preventDefault();
    const point = {
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: event.shiftKey,
      currentTarget: event.currentTarget,
    };
    pointRef.current = point;
    refresh(point, current);
    if (!timerRef.current && point.currentTarget)
      timerRef.current = setInterval(tick, 32);
  };
  const up = (event: PointerEvent<HTMLElement>) => {
    const { current } = dragRef;
    if (current?.pointer !== event.pointerId) return;
    if (current.active) move(event);
    cancel();
    if (!current.active || !current.intent) return;
    finishTaskDrag(
      current,
      () => {
        return mountedRef.current;
      },
      setMessage,
      clearSelection,
    );
  };
  return {
    suppressClick: () => {
      suppressClickUntilRef.current = Date.now() + 350;
    },
    pending: () => {
      return !!dragRef.current;
    },
    preview,
    message,
    dragId,
    handlers: {
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (Date.now() < suppressClickUntilRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: up,
      onPointerCancel: cancel,
    },
  };
};
