import { captureDraftEditors } from "./editor-drafts";
import type { WorkspaceData } from "./types";
export const exportWorkspace = (data: WorkspaceData) => {
  return JSON.stringify(
    {
      format: "ROMDexWebRecovery/1",
      exportedAt: new Date().toISOString(),
      data: {
        ...data,
        editorRecovery: [
          ...(data.editorRecovery ?? []),
          ...captureDraftEditors(
            (data.editorRecovery ?? []).flatMap((record) => {
              const id = record.captureId ?? record.id;
              return typeof id === "string" ? [id] : [];
            }),
          ),
        ],
      },
    },
    null,
    2,
  );
};
