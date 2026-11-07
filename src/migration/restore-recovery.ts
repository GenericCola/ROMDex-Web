import { jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { refImages } from "@/storage/image-storage";
/**
 * Replaces the workspace with a reviewed recovery copy. Automatic delivery
 * stays off, the replaced workspace is kept as `previousBrowser`, and images
 * (already saved to the image store) are stored as refs.
 */
export const restoreRecovery = (
  data: WorkspaceData,
  recovery: WorkspaceData,
  baseline: string,
) => {
  if (JSON.stringify(data) !== baseline)
    throw Error(
      "The workspace changed after preview. Select the recovery file again.",
    );
  const original = structuredClone(data),
    restored = structuredClone(recovery);
  restored.cloud = {
    ...restored.cloud,
    records: restored.cloud?.records ?? {},
    autoSync: false,
  };
  if (restored.migration)
    restored.migration.previousBrowser = jsonObject(
      parseJson(JSON.stringify(original)),
    );
  for (const key of Object.keys(data)) Reflect.deleteProperty(data, key);
  refImages(restored.images);
  Object.assign(data, restored);
};
