import { materialize } from "@/domain/accepted/core.mjs";
import type { DropTarget } from "@/domain/task-drop";
import { workspaceStore } from "@/domain/workspace-store";
import { taskDragPreview, type DragPoint } from "./task-drag-preview";
import type { Drag } from "./task-drag-state";
export const refreshTaskDrag = (
  point: DragPoint,
  current: Drag,
  hoverRef: { current: { id: string; since: number } | null },
  setPreview: (target: DropTarget | null) => void,
  setMessage: (message: string) => void,
  mountedRef: { current: boolean },
) => {
  current.intent = null;
  setPreview(null);
  try {
    const next = taskDragPreview(point, current);
    if (!next) {
      hoverRef.current = null;
      setMessage(
        "Choose a destination. Shift keeps sibling level; Escape cancels.",
      );
      return;
    }
    current.intent = next.intent;
    setPreview(next.result);
    const { data } = workspaceStore.getSnapshot();
    const items = materialize(data.remote, data.operations);
    const name = (id: string | null) => {
      return (
        items.find((item) => {
          return item.id === id;
        })?.summary ?? "All Tasks"
      );
    };
    setMessage(
      `Under ${name(next.result.parentId)} · ${next.result.beforeId ? "before " + name(next.result.beforeId) : "at end"} · Level ${next.result.depth + 1}. Shift: keep level; Escape: cancel.`,
    );
    const parent = next.intent.delta > 0 ? next.intent.targetId : null;
    if (
      parent &&
      items.some((item) => {
        return item.parentId === parent;
      }) &&
      !data.view.expanded.includes(parent)
    ) {
      if (hoverRef.current?.id !== parent)
        hoverRef.current = { id: parent, since: Date.now() };
      else if (Date.now() - hoverRef.current.since >= 650) {
        hoverRef.current.since = Infinity;
        void workspaceStore
          .change((draft) => {
            if (!draft.view.expanded.includes(parent))
              draft.view.expanded.push(parent);
          })
          .catch((reason: unknown) => {
            hoverRef.current = null;
            if (mountedRef.current)
              setMessage(
                reason instanceof Error
                  ? reason.message
                  : "Could not open the destination.",
              );
          });
      }
    } else hoverRef.current = null;
  } catch (error) {
    hoverRef.current = null;
    setMessage(
      error instanceof Error ? error.message : "This move is unavailable.",
    );
  }
};

export const scrollTaskDrag = (point: DragPoint) => {
  let scrolled = false;
  // Navigate even over an invalid target; validate the newly exposed row afterward.
  for (const scroller of point.currentTarget.querySelectorAll<HTMLElement>(
    ".table-scroll,#selectors",
  )) {
    const rect = scroller.getBoundingClientRect();
    if (
      point.clientX < rect.left ||
      point.clientX > rect.right ||
      point.clientY < rect.top ||
      point.clientY > rect.bottom
    )
      continue;
    const previous = scroller.scrollTop;
    const header =
      scroller.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    if (point.clientY < rect.top + header + 40) scroller.scrollTop -= 12;
    else if (point.clientY > rect.bottom - 40) scroller.scrollTop += 12;
    scrolled ||= scroller.scrollTop !== previous;
  }

  return scrolled;
};
