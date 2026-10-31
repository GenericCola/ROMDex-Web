import { jsonObject, type JsonObject, type JsonValue } from "./json";
import type { WorkspaceData } from "./types";
const taskId = (value: JsonValue | undefined) => {
  return (
    typeof value === "string" &&
    /^(PMON-[1-9]\d*|local-[\w-]{1,100})$/.test(value)
  );
};
const keys = (value: JsonObject, allowed: string[]) => {
  return Object.keys(value).every((key) => {
    return allowed.includes(key);
  });
};
const knownLegacyCapture = (record: JsonObject) => {
  if (record.kind === "tile-settings")
    return (
      keys(record, [
        "kind",
        "id",
        "baseSummary",
        "baseImage",
        "name",
        "image",
      ]) &&
      taskId(record.id) &&
      typeof record.baseSummary === "string" &&
      typeof record.name === "string" &&
      [record.baseImage, record.image].every((image) => {
        return image === null || typeof image === "string";
      })
    );
  if (record.kind === "group-parent")
    return (
      keys(record, ["kind", "ids", "parentId", "title"]) &&
      Array.isArray(record.ids) &&
      record.ids.length > 0 &&
      record.ids.length <= 1000 &&
      record.ids.every(taskId) &&
      new Set(record.ids).size === record.ids.length &&
      (record.parentId === null || taskId(record.parentId)) &&
      typeof record.title === "string"
    );
  if (
    record.kind !== "rdx-plan-editor" ||
    !keys(record, ["kind", "fields"]) ||
    !Array.isArray(record.fields) ||
    record.fields.length > 1000
  )
    return false;
  return record.fields.every((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field))
      return false;
    return (
      keys(field, ["label", "value"]) &&
      typeof field.label === "string" &&
      typeof field.value === "string"
    );
  });
};
// Preserve legacy task IDs; capture identity is separate from the edited object.
export const identifyLegacyEditorCaptures = (data: WorkspaceData) => {
  const entries = data.editorRecovery ?? [];
  const used = new Set(
    entries.flatMap((entry) => {
      const record = jsonObject(entry);
      return [record.captureId, record.id];
    }),
  );
  for (const [index, entry] of entries.entries()) {
    const record = jsonObject(entry);
    if (
      record.captureId !== undefined ||
      typeof record.kind !== "string" ||
      !knownLegacyCapture(record)
    )
      continue;
    const prefix = "capture:legacy:" + record.kind + ":" + index;
    let id = prefix,
      suffix = 0;
    while (used.has(id)) id = prefix + ":" + ++suffix;
    record.captureId = id;
    used.add(id);
  }
};
