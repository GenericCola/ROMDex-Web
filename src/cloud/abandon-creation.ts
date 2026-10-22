import type { WorkspaceData } from "@/domain/types";
import { recordDelivery } from "./journal";
export const abandonCreation = (data: WorkspaceData, opId: string) => {
  const operation = data.operations.find((op) => {
    return op.opId === opId;
  });
  if (operation?.type !== "create") throw Error("Creation no longer pending.");
  const ids = new Set([operation.issueId]);
  let size = 0;
  while (size !== ids.size) {
    ({ size } = ids);
    for (const op of data.operations)
      if (op.type === "create" && op.item.parentId && ids.has(op.item.parentId))
        ids.add(op.issueId);
  }
  data.operations = data.operations.filter((op) => {
    const dependent =
      ids.has(op.issueId) ||
      (op.type === "edit" && !!op.patch.parentId && ids.has(op.patch.parentId));
    if (dependent)
      recordDelivery(data, op.opId, {
        status: "confirmed",
        archivedOperation: op,
        message:
          "Creation/dependent change explicitly stopped. A cloud task may still exist; inspect YouTrack before creating again.",
      });
    return !dependent;
  });
  if (data.view.selected && ids.has(data.view.selected))
    data.view.selected = null;
  if (data.view.scope && ids.has(data.view.scope)) data.view.scope = null;
};
