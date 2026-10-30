import type { WorkspaceData } from "@/domain/types";
import { cloudData } from "./types";
export const initializeAutomaticSync = (
  data: WorkspaceData,
  isNew: boolean,
) => {
  if (isNew && !data.cloud) data.cloud = { autoSync: true, records: {} };
};
export const connectionNeedsManualSave = (data: WorkspaceData) => {
  return Object.values(cloudData(data).records ?? {}).some((record) => {
    return record.status !== "confirmed";
  });
};
