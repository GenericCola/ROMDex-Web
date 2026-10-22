import type { WorkspaceData } from "@/domain/types";
import { validateStatusWrite } from "./shared-status-protocol";
export const validateStatuses = (data: WorkspaceData) => {
  const { cloud } = data;
  const invalid = () => {
    throw Error(
      "The assigned-status journal is invalid. Existing browser data has been kept.",
    );
  };
  if (
    cloud?.sharedStatuses !== undefined &&
    typeof cloud.sharedStatuses !== "boolean"
  )
    invalid();
  if (
    cloud?.sharedStatuses &&
    data.remote.some((item) => {
      return (
        item.sharedStatus?.state !== item.state ||
        item.sharedStatus.updated !== item.updated ||
        item.sharedStatus.assignedState !== item.assignedState
      );
    })
  )
    invalid();
  for (const [opId, record] of Object.entries(cloud?.records ?? {})) {
    if (!record?.metadataWrite) continue;
    validateStatusWrite(record.metadataWrite);
    const op =
      data.operations.find((entry) => {
        return entry.opId === opId;
      }) ?? record.archivedOperation;
    if (
      !cloud?.sharedStatuses ||
      op?.type !== "edit" ||
      record.metadataWrite.opId !== opId ||
      record.metadataWrite.kind !==
        (op.purpose === "rollup" ? "rollup" : "assign") ||
      record.metadataWrite.value !==
        (op.purpose === "rollup"
          ? op.patch.state
          : (op.patch.assignedState ?? op.patch.state))
    )
      invalid();
  }
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
