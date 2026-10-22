import type { WorkspaceData } from "@/domain/types";
export const validateStatuses = (data: WorkspaceData) => {
  const { cloud } = data;
  const invalid = () => {
    throw Error(
      "The assigned-status journal is invalid. Existing browser data has been kept.",
    );
  };
  if (
    cloud?.rollupPending !== undefined &&
    typeof cloud.rollupPending !== "boolean"
  )
    invalid();
  if (cloud?.assigned !== undefined) {
    if (
      !cloud.assigned ||
      typeof cloud.assigned !== "object" ||
      Array.isArray(cloud.assigned)
    )
      invalid();
    for (const [id, record] of Object.entries(cloud.assigned)) {
      if (
        !/^PMON-\d+$/.test(id) ||
        !record ||
        typeof record !== "object" ||
        typeof record.assignedState !== "string" ||
        !record.assignedState ||
        typeof record.lastState !== "string" ||
        !record.lastState ||
        (record.lastUpdated !== null &&
          (typeof record.lastUpdated !== "number" ||
            !Number.isFinite(record.lastUpdated))) ||
        (record.pendingState !== null &&
          (typeof record.pendingState !== "string" || !record.pendingState))
      )
        invalid();
      if (
        record.pendingState !== null &&
        !data.operations.some((op) => {
          return (
            op.type === "edit" &&
            op.purpose === "rollup" &&
            op.issueId === id &&
            op.patch.state === record.pendingState &&
            ["attempting", "uncertain"].includes(
              cloud.records[op.opId]?.status ?? "",
            )
          );
        })
      )
        invalid();
    }
  }
  for (const op of data.operations) {
    if (op.type !== "edit") continue;
    if (op.purpose !== undefined && op.purpose !== "rollup") invalid();
    if (
      op.purpose === "rollup" &&
      (!cloud?.rollupPending ||
        !cloud.assigned?.[op.issueId] ||
        !op.patch.state ||
        !op.patch.assignedState ||
        Object.keys(op.patch).some((key) => {
          return !["state", "assignedState"].includes(key);
        }))
    )
      invalid();
    if (
      op.purpose !== "rollup" &&
      op.patch.state !== undefined &&
      op.patch.assignedState !== undefined &&
      op.patch.state !== op.patch.assignedState
    )
      invalid();
  }
};
