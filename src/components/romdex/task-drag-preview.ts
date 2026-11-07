import { materialize } from "@/domain/accepted/core.mjs";
import { bulkMovePlan } from "@/domain/bulk-hierarchy";
import { hierarchySignature, rowDropTarget } from "@/domain/task-drop";
import { workspaceStore } from "@/domain/workspace-store";
import type { Drag } from "./task-drag-state";
import { rowOrder } from "./task-row-order";
export interface DragPoint {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  currentTarget: HTMLElement;
}
export const taskDragPreview = (event: DragPoint, current: Drag) => {
  let row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>("[data-row],[data-selector]");
  // Empty space below the last row is still an end-of-list drop target.
  if (!row) {
    const scroller = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".table-scroll");
    const last = scroller
      ? [...scroller.querySelectorAll<HTMLElement>("[data-row]")].at(-1)
      : null;
    // Below a spacer for unrendered rows is not the end of the list.
    if (
      last &&
      scroller &&
      last.dataset.row === rowOrder(scroller).at(-1) &&
      event.clientY >= last.getBoundingClientRect().bottom
    )
      row = last;
  }
  const targetId = row?.dataset.row ?? row?.dataset.selector;
  if (!row || !targetId || !event.currentTarget.contains(row)) return null;
  const selector = !!row.dataset.selector;
  const bounds = row.getBoundingClientRect();
  const intent = {
    dragId: current.id,
    targetId,
    delta: selector
      ? 1
      : event.shiftKey
        ? 0
        : dragDepthDelta(event.clientX - current.x),
    after: selector || event.clientY >= bounds.top + bounds.height / 2,
  };
  const { data } = workspaceStore.getSnapshot();
  if (hierarchySignature(data) !== current.signature)
    throw Error("The hierarchy changed during the drag. Try again.");
  const result = rowDropTarget(
    materialize(data.remote, data.operations),
    data.order,
    intent,
    rowOrder(event.currentTarget),
  );
  if (!result) return null;
  if (current.bulkIds)
    bulkMovePlan(
      materialize(data.remote, data.operations),
      data.order,
      current.bulkIds,
      result.parentId,
      result.beforeId,
    );

  return {
    result: { ...result, ...(selector ? { selectorId: targetId } : {}) },
    intent,
  };
};

// A full deliberate step before changing level avoids accidental 13px nesting.
export const dragDepthDelta = (distance: number) => {
  const steps = Math.floor(Math.abs(distance) / 26);
  return steps === 0 ? 0 : Math.sign(distance) * steps;
};
