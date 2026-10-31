import type { WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
export const initializeAutomaticSync = (
  data: WorkspaceData,
  isNew: boolean,
) => {
  if (isNew && !data.cloud) data.cloud = { autoSync: true, records: {} };
};
export const connectionNeedsManualSave = (data: WorkspaceData) => {
  return Object.entries(cloudData(data).records ?? {}).some(([id, record]) => {
    return (
      record.status !== "confirmed" &&
      data.operations.find((op) => {
        return op.opId === id;
      })?.type !== "delete"
    );
  });
};
