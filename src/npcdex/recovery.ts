import { jsonObject } from "@/domain/json";
import { identifyLegacyEditorCaptures } from "@/domain/legacy-editor-captures";
import { identifyLegacyItemRecovery } from "@/domain/legacy-editor-recovery";
import type { WorkspaceData } from "@/domain/types";
export const validateEditorRecovery = (data: WorkspaceData) => {
  if (data.editorRecovery === undefined) return;
  if (!Array.isArray(data.editorRecovery) || data.editorRecovery.length > 1000)
    throw Error("Invalid recovered editor entries.");
  identifyLegacyItemRecovery(data);
  identifyLegacyEditorCaptures(data);
  const ids = new Set<string>();
  for (const entry of data.editorRecovery) {
    const record = jsonObject(entry);
    const identity = record.captureId ?? record.id;
    if (
      (record.captureId !== undefined &&
        (typeof record.captureId !== "string" || !record.captureId)) ||
      typeof identity !== "string" ||
      typeof record.kind !== "string" ||
      ids.has(identity)
    )
      throw Error("Invalid recovered editor identity.");
    ids.add(identity);
  }
};
