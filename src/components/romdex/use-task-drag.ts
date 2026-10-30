import { commitBulkTaskDrop } from "@/domain/bulk-drop-commit";
import type { DropTarget } from "@/domain/task-drop";
import { commitTaskDrop } from "@/domain/task-drop-commit";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { taskDragPreview } from "./task-drag-preview";
import { startTaskDrag } from "./task-drag-start";
import type { Drag } from "./task-drag-state";
export const useTaskDrag = (
  selectedIds: string[] = [],
  clearSelection?: () => void,
) => {
  const dragRef = useRef<Drag | null>(null),
    mountedRef = useRef(true),
    suppressClickUntilRef = useRef(0);
  const [preview, setPreview] = useState<DropTarget | null>(null);
  const [message, setMessage] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const cancel = () => {
    dragRef.current = null;
    setPreview(null);
    setDragId(null);
  };
  useEffect(() => {
    mountedRef.current = true;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault();
        cancel();
        setMessage("Move cancelled.");
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      mountedRef.current = false;
      dragRef.current = null;
      window.removeEventListener("keydown", escape);
    };
  }, []);
  const down = (event: PointerEvent<HTMLElement>) => {
    try {
      dragRef.current = startTaskDrag(event, selectedIds);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This selection cannot be moved.",
      );
    }
  };
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
    current.intent = null;
    setPreview(null);
    try {
      const preview = taskDragPreview(event, current);
      if (!preview) return;
      current.intent = preview.intent;
      setPreview(preview.result);
      setMessage(
        `Move to level ${preview.result.depth + 1}. Release to move; Escape to cancel.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "This move is unavailable.",
      );
    }
  };
  const up = (event: PointerEvent<HTMLElement>) => {
    const { current } = dragRef;
    if (current?.pointer !== event.pointerId) return;
    if (current.active) {
      move(event);
      suppressClickUntilRef.current = Date.now() + 350;
    }
    cancel();
    if (!current.active || !current.intent) return;
    const { intent } = current;
    const stillCurrent = () => {
      return mountedRef.current;
    };
    const commit = current.bulkIds
      ? commitBulkTaskDrop(
          current.bulkIds,
          intent,
          current.signature,
          stillCurrent,
        )
      : commitTaskDrop(intent, current.signature, stillCurrent);
    void commit.then(
      () => {
        if (mountedRef.current) {
          setMessage(current.bulkIds ? "Selected Items Moved." : "Item moved.");
          if (current.bulkIds) clearSelection?.();
        }
      },
      (error: unknown) => {
        if (mountedRef.current)
          setMessage(
            error instanceof Error
              ? error.message
              : "The move could not be saved.",
          );
      },
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
