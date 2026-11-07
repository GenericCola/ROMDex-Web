import { imageUrl, missingImages } from "@/storage/image-storage";
import { captureDraftEditors } from "./editor-drafts";
import type { WorkspaceData } from "./types";
/** Image refs back to data URLs; a missing image keeps its ref. */
const imageData = (images: unknown) => {
  if (!images || typeof images !== "object") return images;
  return Object.fromEntries(
    Object.entries(images).map(([id, value]: [string, unknown]) => {
      return [
        id,
        typeof value === "string" ? (imageUrl(value) ?? value) : value,
      ] as const;
    }),
  );
};
const withImageData = (data: WorkspaceData) => {
  const previous = data.migration?.previousBrowser;
  return {
    ...(data.images ? { images: imageData(data.images) } : {}),
    ...(previous && "images" in previous
      ? {
          migration: {
            ...data.migration,
            previousBrowser: {
              ...previous,
              images: imageData(previous.images),
            },
          },
        }
      : {}),
  };
};
export const exportWorkspace = (data: WorkspaceData) => {
  return JSON.stringify(
    {
      format: "ROMDexWebRecovery/1",
      exportedAt: new Date().toISOString(),
      missingImages: missingImages(),
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
