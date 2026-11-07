import type { WorkspaceData } from "@/domain/types";
import { IMAGE_REF, loadImages, putImage } from "./image-storage";

/**
 * Makes every image in `data` readable from memory. Refs are loaded; legacy
 * data URLs are saved and answered as `{ id: ref }`. If any save fails the
 * answer is empty and the legacy values stay as they are (retried next load).
 */
export const prepareImages = async (data: WorkspaceData) => {
  const entries = Object.entries(data.images ?? {});
  const stored = entries.filter(([, value]) => {
    return IMAGE_REF.test(value);
  });
  // A missing image fails softly: the workspace still opens, the tile shows a
  // notice, and recovery copies list the ref (see missingImages).
  await loadImages(
    stored.map(([, value]) => {
      return value;
    }),
  );
  const legacy = entries.filter(([, value]) => {
    return !IMAGE_REF.test(value);
  });
  const migrated: Record<string, string> = {};
  try {
    for (const [id, value] of legacy) migrated[id] = await putImage(value);
  } catch {
    return {};
  }
  return migrated;
};

/** Rewrites still-legacy values to refs. Anything edited since is left alone. */
export const swapToRefs = (
  data: WorkspaceData,
  before: WorkspaceData,
  migrated: Record<string, string>,
) => {
  for (const [id, ref] of Object.entries(migrated))
    if (data.images && data.images[id] === before.images?.[id])
      data.images[id] = ref;
};
