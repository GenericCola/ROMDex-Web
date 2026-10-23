import type { JsonObject } from "@/domain/json";
import { jsonObject } from "@/domain/json";
import type { NpcdexDraft, NpcdexTarget } from "./model";
export const recoveredDraft = (record: JsonObject): NpcdexDraft | null => {
  if (record.kind !== "NPCDexDraft") return null;
  const draft = jsonObject(record.draft),
    input = jsonObject(draft.target),
    target: NpcdexTarget = {
      town: "",
      area: "",
      element: "",
      point: "",
      block: "",
    };
  for (const key of ["town", "area", "element", "point", "block"] as const) {
    const value = input[key];
    if (typeof value !== "string")
      throw Error("Invalid recovered draft target.");
    target[key] = value;
  }
  const {
    sourceRevision,
    note,
    intent,
    instructions,
    proposedText,
    flag,
    updatedAt,
  } = draft;
  if (
    typeof sourceRevision !== "string" ||
    typeof note !== "string" ||
    typeof intent !== "string" ||
    typeof instructions !== "string" ||
    typeof proposedText !== "string" ||
    typeof updatedAt !== "string" ||
    (flag !== "none" && flag !== "flagged" && flag !== "critical")
  )
    throw Error("Invalid recovered NPCDex draft.");
  return {
    target,
    sourceRevision,
    note,
    intent,
    instructions,
    proposedText,
    flag,
    updatedAt,
  };
};
