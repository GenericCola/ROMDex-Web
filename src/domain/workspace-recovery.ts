import type { WorkspaceData } from "./types";
export const exportWorkspace = (data: WorkspaceData) => {
  return JSON.stringify(
    {
      format: "ROMDexWebRecovery/1",
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
};
