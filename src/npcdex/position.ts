import type { JsonObject } from "@/domain/json";
import type { NpcdexTarget } from "./model";
export const emptyNpcdexTarget = (): NpcdexTarget => {
  return { town: "", area: "", element: "", point: "", block: "" };
};
export const preferredGender = (document: JsonObject | undefined) => {
  const preferences = document?.preferences;
  return preferences &&
    typeof preferences === "object" &&
    !Array.isArray(preferences) &&
    preferences.gender === "female"
    ? "female"
    : "male";
};
