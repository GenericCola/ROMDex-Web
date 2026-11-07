import { imageUrl } from "@/storage/image-storage";
import { captureDraftEditors } from "./editor-drafts";
import type { WorkspaceData } from "./types";
const withImageData = (data: WorkspaceData) => {
  if (!data.images) return {};
  return {
    images: Object.fromEntries(
      Object.entries(data.images).map(([id, value]) => {
        const url = imageUrl(value);
        if (url === null) throw Error("A tile image is not loaded.");
        return [id, url] as const;
      }),
    ),
  };
};
export const exportWorkspace = (data: WorkspaceData) => {
  return JSON.stringify(
    {
      format: "ROMDexWebRecovery/1",
      exportedAt: new Date().toISOString(),
      data: {
        ...data,
        ...withImageData(data),
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
