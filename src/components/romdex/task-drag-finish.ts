import { commitBulkTaskDrop } from "@/domain/bulk-drop-commit";
import { commitTaskDrop } from "@/domain/task-drop-commit";
import type { Drag } from "./task-drag-state";
export const finishTaskDrag = (
  current: Drag,
  stillCurrent: () => boolean,
  setMessage: (message: string) => void,
  clearSelection?: () => void,
) => {
  const { intent } = current;
  if (!intent) return;
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
      if (stillCurrent()) {
        setMessage(current.bulkIds ? "Selected Items Moved." : "Item moved.");
        if (current.bulkIds) clearSelection?.();
      }
    },
    (error: unknown) => {
      if (stillCurrent())
        setMessage(
          error instanceof Error
            ? error.message
            : "The move could not be saved.",
        );
    },
  );
};
