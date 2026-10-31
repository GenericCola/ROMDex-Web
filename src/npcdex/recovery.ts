import { jsonObject } from "@/domain/json";
import { identifyLegacyItemRecovery } from "@/domain/legacy-editor-recovery";
import type { WorkspaceData } from "@/domain/types";
export const validateEditorRecovery = (data: WorkspaceData) => {
  if (data.editorRecovery === undefined) return;
  if (!Array.isArray(data.editorRecovery) || data.editorRecovery.length > 1000)
    throw Error("Invalid recovered editor entries.");
  identifyLegacyItemRecovery(data);
  const ids = new Set<string>();
  for (const entry of data.editorRecovery) {
    const record = jsonObject(entry);
    if (
      typeof record.id !== "string" ||
      typeof record.kind !== "string" ||
      ids.has(record.id)
    )
      throw Error("Invalid recovered editor identity.");
    ids.add(record.id);
  }
};
