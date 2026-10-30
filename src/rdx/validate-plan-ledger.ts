import type { WorkspaceData } from "@/domain/types";
const object = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
const strings = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      return typeof entry === "string" && !!entry;
    }) &&
    new Set(value).size === value.length
  );
};
export const validatePlanLedger = (data: WorkspaceData) => {
  if (data.rdxImports === undefined) return;
  if (!object(data.rdxImports))
    throw Error("Invalid task plan ledger. Keep recovery.");
  for (const ledger of Object.values(data.rdxImports)) {
    if (
      !object(ledger) ||
      !object(ledger.tasks) ||
      !object(ledger.batches) ||
      (ledger.review !== undefined && !object(ledger.review))
    )
      throw Error("Invalid task plan ledger. Keep recovery.");
    for (const binding of Object.values(ledger.tasks)) {
      if (
        !object(binding) ||
        typeof binding.issueId !== "string" ||
        !binding.issueId ||
        !object(binding.desired)
      )
        throw Error("Invalid task plan binding. Keep recovery.");
    }
    for (const [id, batch] of Object.entries(ledger.batches)) {
      if (
        !object(batch) ||
        batch.id !== id ||
        typeof batch.revision !== "string" ||
        !/^[a-f0-9]{64}$/.test(batch.revision) ||
        !strings(batch.opIds) ||
        !strings(batch.taskIds) ||
        !strings(batch.completed) ||
        ![
          "pending",
          "complete",
          "needs-review",
          "blocked",
          "cancelled",
        ].includes(String(batch.status))
      )
        throw Error("Invalid task plan batch. Keep recovery.");
      if (
        (batch.destination !== undefined &&
          batch.destination !== null &&
          (typeof batch.destination !== "string" || !batch.destination)) ||
        (batch.entries !== undefined &&
          (!Array.isArray(batch.entries) ||
            batch.entries.length !== batch.opIds.length ||
            new Set(
              batch.entries.map((entry) => {
                return object(entry) ? entry.opId : null;
              }),
            ).size !== batch.entries.length ||
            batch.entries.some((entry) => {
              return (
                !object(entry) ||
                typeof entry.opId !== "string" ||
                !batch.opIds.includes(entry.opId) ||
                typeof entry.type !== "string" ||
                ![
                  "create",
                  "edit",
                  "delete",
                  "comment",
                  "attachment",
                  "attachment-delete",
                ].includes(entry.type) ||
                typeof entry.issueId !== "string" ||
                !entry.issueId
              );
            })))
      )
        throw Error("Invalid task plan delivery metadata. Keep recovery.");
      if (
        batch.completed.some((opId) => {
          return !batch.opIds.includes(opId);
        }) ||
        batch.taskIds.some((taskId) => {
          return !ledger.tasks[taskId];
        }) ||
        (batch.status === "complete" &&
          batch.completed.length !== batch.opIds.length)
      )
        throw Error("Invalid task plan receipt. Keep recovery.");
    }
  }
};
