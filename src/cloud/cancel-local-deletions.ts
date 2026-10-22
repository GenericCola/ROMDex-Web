import type { WorkspaceData } from "@/domain/types";
import { recordDelivery } from "./journal";
import { cloudData } from "./types";
export const cancelLocalDeletions = (data: WorkspaceData) => {
  const local = new Set(
    data.operations.flatMap((op) => {
      return op.type === "delete"
        ? op.ids.filter((id) => {
            return id.startsWith("local-");
          })
        : [];
    }),
  );
  if (!local.size) return;
  for (const op of data.operations)
    if (local.has(op.issueId) && cloudData(data).records[op.opId])
      throw Error(
        "Review the earlier local creation result before cancelling it.",
      );
  data.operations = data.operations.filter((op) => {
    const original = structuredClone(op);
    if (op.type === "delete") {
      op.ids = op.ids.filter((id) => {
        return !local.has(id);
      });
      for (const id of local) if (op.bases) delete op.bases[id];
      if (op.ids.length) {
        if (local.has(op.issueId)) op.issueId = op.ids[0] ?? op.issueId;
        return true;
      }
    } else if (!local.has(op.issueId)) return true;
    recordDelivery(data, op.opId, {
      status: "confirmed",
      archivedOperation: original,
      message: "Unsent local task deletion cancelled without cloud writes.",
    });
    return false;
  });
  if (data.view.selected && local.has(data.view.selected))
    data.view.selected = null;
  if (data.view.scope && local.has(data.view.scope)) data.view.scope = null;
};
