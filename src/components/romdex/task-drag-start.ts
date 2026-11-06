import { materialize } from "@/domain/accepted/core.mjs";
import { siblingSelection } from "@/domain/bulk-hierarchy";
import { hierarchySignature } from "@/domain/task-drop";
import { taskEditingLocked } from "@/domain/task-edit-lock";
import { workspaceStore } from "@/domain/workspace-store";
import type { PointerEvent } from "react";
import type { Drag } from "./task-drag-state";
export const startTaskDrag = (
  event: PointerEvent<HTMLElement>,
  selectedIds: string[],
): Drag | null => {
  // Touch/pen gestures scroll; hierarchy moves require a deliberate mouse drag.
  if (event.pointerType !== "mouse") return null;
  const grip = (event.target as Element).closest<HTMLElement>(
    "[data-drag],.selector-main[data-select]",
  );
  const id = grip?.dataset.drag ?? grip?.dataset.select;
  if (event.button !== 0 || !id || !grip) return null;
  const state = workspaceStore.getSnapshot();
  if (!state.ready)
    throw Error("Wait for your workspace to open before moving items.");
  if (state.error) throw Error(state.error);
  if (state.updating)
    throw Error("Wait for the app update to finish before moving items.");
  if (document.querySelector('input[aria-label="New Parent Title"]'))
    throw Error("Finish or cancel the new parent before moving items.");
  if (taskEditingLocked(id))
    throw Error(
      "This ticket is being synchronized or needs review. Other unlocked tickets can still be moved.",
    );
  let bulkIds: string[] | undefined;
  if (grip.dataset.drag && selectedIds.length > 1) {
    if (!selectedIds.includes(id))
      throw Error("Drag a Checked Item to Move the Selection.");
    if (
      selectedIds.some((selected) => {
        return taskEditingLocked(selected);
      })
    )
      throw Error(
        "A checked ticket is being synchronized or needs review. Wait or change the selection before moving it.",
      );
    bulkIds = siblingSelection(
      materialize(state.data.remote, state.data.operations),
      state.data.order,
      selectedIds,
    ).members.map((item) => {
      return item.id;
    });
  }
  grip.setPointerCapture(event.pointerId);
  return {
    ...(bulkIds ? { bulkIds } : {}),
    id,
    capture: grip,
    x: event.clientX,
    y: event.clientY,
    pointer: event.pointerId,
    signature: hierarchySignature(state.data),
    active: false,
    intent: null,
  };
};
