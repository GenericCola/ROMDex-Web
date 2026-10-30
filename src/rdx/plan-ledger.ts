import type { JsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
export interface PlanBinding extends JsonObject {
  issueId: string;
  desired: JsonObject;
}
export interface PlanBatchRecord {
  id: string;
  revision: string;
  taskIds: string[];
  opIds: string[];
  completed: string[];
  status: "pending" | "complete" | "needs-review";
}
export interface PlanLedger {
  tasks: Record<string, PlanBinding>;
  batches: Record<string, PlanBatchRecord>;
}
export const planReceipt = (
  data: WorkspaceData,
  opId: string,
  mapping: Record<string, string> = {},
  followup?: string,
) => {
  for (const ledger of Object.values(data.rdxImports ?? {})) {
    for (const binding of Object.values(ledger.tasks)) {
      binding.issueId = mapping[binding.issueId] ?? binding.issueId;
      const parent = binding.desired.parentId;
      if (typeof parent === "string")
        binding.desired.parentId = mapping[parent] ?? parent;
    }
    for (const batch of Object.values(ledger.batches)) {
      if (!batch.opIds.includes(opId)) continue;
      if (followup && !batch.opIds.includes(followup))
        batch.opIds.push(followup);
      if (!batch.completed.includes(opId)) batch.completed.push(opId);
      batch.status = batch.opIds.every((id) => {
        return batch.completed.includes(id);
      })
        ? "complete"
        : "pending";
      if (batch.status === "complete")
        for (const taskId of batch.taskIds) {
          const binding = ledger.tasks[taskId];
          if (!binding) continue;
          const current = data.remote.find((item) => {
            return item.id === binding.issueId;
          });
          if (current) binding.nativeUpdated = current.updated;
        }
    }
  }
};
