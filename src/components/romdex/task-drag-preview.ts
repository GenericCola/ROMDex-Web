import { materialize } from "@/domain/accepted/core.mjs";
import { bulkMovePlan } from "@/domain/bulk-hierarchy";
import { hierarchySignature, rowDropTarget } from "@/domain/task-drop";
import { workspaceStore } from "@/domain/workspace-store";
import type { PointerEvent } from "react";
import type { Drag } from "./task-drag-state";
export const taskDragPreview = (
  event: PointerEvent<HTMLElement>,
  current: Drag,
) => {
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>("[data-row],[data-selector]");
  const targetId = row?.dataset.row ?? row?.dataset.selector;
  if (!row || !targetId || !event.currentTarget.contains(row)) return null;
  const selector = !!row.dataset.selector;
  const bounds = row.getBoundingClientRect();
  const intent = {
    dragId: current.id,
    targetId,
    delta: selector ? 1 : Math.round((event.clientX - current.x) / 26),
    after: selector || event.clientY >= bounds.top + bounds.height / 2,
  };
  const { data } = workspaceStore.getSnapshot();
  if (hierarchySignature(data) !== current.signature)
    throw Error("The hierarchy changed during the drag. Try again.");
  const visibleIds = [
    ...event.currentTarget.querySelectorAll<HTMLElement>("[data-row]"),
  ].map((element) => {
    return element.dataset.row ?? "";
  });
  const result = rowDropTarget(
    materialize(data.remote, data.operations),
    data.order,
    intent,
    visibleIds,
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

  const scroller = row.closest(".table-scroll,#selectors");
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    if (event.clientY < rect.top + 35) scroller.scrollTop -= 14;
    else if (event.clientY > rect.bottom - 35) scroller.scrollTop += 14;
  }

  return {
    result: { ...result, ...(selector ? { selectorId: targetId } : {}) },
    intent,
  };
};
