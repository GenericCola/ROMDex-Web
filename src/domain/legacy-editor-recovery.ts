import { jsonObject } from "./json";
import type { WorkspaceData } from "./types";
// Early item-editor exports omitted the identity required by recovery import.
export const identifyLegacyItemRecovery = (data: WorkspaceData) => {
  const entries = data.editorRecovery ?? [];
  const used = new Set(
    entries.flatMap((entry) => {
      const record = jsonObject(entry);
      return [record.id, record.captureId];
    }),
  );
  for (const [index, entry] of entries.entries()) {
    const record = jsonObject(entry);
    if (
      record.id !== undefined ||
      record.kind !== "item-editor" ||
      typeof record.issueId !== "string" ||
      !/^(PMON-[1-9]\d*|local-[\w-]{1,100})$/.test(record.issueId) ||
      Object.keys(record).some((key) => {
        return !["kind", "issueId", "fields"].includes(key);
      }) ||
      !Array.isArray(record.fields) ||
      record.fields.length > 1000 ||
      !record.fields.every((field) => {
        if (!field || typeof field !== "object" || Array.isArray(field))
          return false;
        return (
          typeof field.id === "string" &&
          typeof field.value === "string" &&
          Object.keys(field).every((key) => {
            return ["id", "value"].includes(key);
          })
        );
      })
    )
      continue;
    const prefix = "item-editor:legacy:" + record.issueId + ":" + index;
    let id = prefix,
      suffix = 0;
    while (used.has(id)) id = prefix + ":" + ++suffix;
    record.id = id;
    used.add(id);
  }
};
