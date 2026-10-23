import type { JsonObject, JsonValue } from "@/domain/json";
import { jsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
export const nodeText = (
  node: JsonObject | undefined,
  key: string,
  fallback = "",
) => {
  const value = node?.[key];
  return typeof value === "string" ? value : fallback;
};
export const nodes = (
  node: JsonObject | undefined,
  key: string,
): JsonObject[] => {
  const value = node?.[key];
  return Array.isArray(value) ? value.map(jsonObject) : [];
};
export const findNode = (items: JsonObject[], id: string) => {
  return items.find((item) => {
    return item.id === id;
  });
};
export interface NpcdexTarget {
  town: string;
  area: string;
  element: string;
  point: string;
  block: string;
}
export interface NpcdexDraft {
  target: NpcdexTarget;
  sourceRevision: string;
  note: string;
  intent: string;
  instructions: string;
  proposedText: string;
  flag: "none" | "flagged" | "critical";
  updatedAt: string;
}
export const targetKey = (target: NpcdexTarget) => {
  return JSON.stringify([
    target.town,
    target.area,
    target.element,
    target.point,
    target.block,
  ]);
};
export const contentRevision = (document: JsonObject) => {
  const value = document.contentRevision ?? document.revision ?? 0;
  if (typeof value !== "string" && typeof value !== "number")
    throw Error("Invalid NPCDex revision.");
  return String(value);
};
export const contentTarget = (document: JsonObject, target: NpcdexTarget) => {
  const town = findNode(nodes(document, "towns"), target.town),
    area = findNode(nodes(town, "areas"), target.area),
    element = findNode(nodes(area, "elements"), target.element),
    point = findNode(nodes(element, "points"), target.point),
    block = findNode(nodes(point, "blocks"), target.block);
  return { town, area, element, point, block };
};
export const saveNpcdexDraft = (data: WorkspaceData, draft: NpcdexDraft) => {
  if (!data.npcdex) throw Error("Import NPCDex data first.");
  if (contentRevision(data.npcdex) !== draft.sourceRevision)
    throw Error(
      "NPCDex content changed. Preserve and review the draft against its new revision.",
    );
  const target = contentTarget(data.npcdex, draft.target);
  if (
    !target.town ||
    (draft.target.area && !target.area) ||
    (draft.target.element && !target.element) ||
    (draft.target.point && !target.point) ||
    (draft.target.block && !target.block)
  )
    throw Error("The NPCDex draft target no longer exists.");
  const key = targetKey(draft.target),
    previous = data.npcdexDrafts?.[key] ?? null;
  data.npcdexDrafts ??= {};
  data.npcdexHistory ??= [];
  data.npcdexHistory.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    target: key,
    before: JSON.parse(JSON.stringify(previous)) as JsonValue,
    after: JSON.parse(JSON.stringify(draft)) as JsonValue,
  });
  data.npcdexDrafts[key] = structuredClone(draft);
};
export const validateNpcdexDrafts = (data: WorkspaceData) => {
  const position = data.view.npcdex;
  if (
    position &&
    (!position.target ||
      !["male", "female"].includes(position.gender) ||
      typeof position.stage !== "string" ||
      !["town", "area", "element", "point", "block"].every((key) => {
        return typeof Reflect.get(position.target, key) === "string";
      }))
  )
    throw Error("Invalid NPCDex saved position.");
  for (const [key, draft] of Object.entries(data.npcdexDrafts ?? {})) {
    if (
      !draft?.target ||
      key !== targetKey(draft.target) ||
      ![
        draft.target.town,
        draft.target.area,
        draft.target.element,
        draft.target.point,
        draft.target.block,
      ].every((value) => {
        return typeof value === "string";
      }) ||
      ![
        draft.note,
        draft.intent,
        draft.instructions,
        draft.proposedText,
        draft.sourceRevision,
        draft.updatedAt,
      ].every((value) => {
        return typeof value === "string";
      }) ||
      !["none", "flagged", "critical"].includes(draft.flag)
    )
      throw Error("Invalid NPCDex draft journal. Existing data is preserved.");
  }
  if (data.npcdexHistory && !Array.isArray(data.npcdexHistory))
    throw Error("Invalid NPCDex history.");
};
export const rasterImage = (value: JsonValue | undefined): string | null => {
  const image =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && !Array.isArray(value)
        ? value.dataUrl
        : null;
  return typeof image === "string" &&
    /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(image) &&
    image.length <= 32 * 1024 * 1024
    ? image
    : null;
};
