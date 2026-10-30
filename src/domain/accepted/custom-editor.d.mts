import type { JsonObject, JsonValue } from "../json";
export function customValue(field: JsonObject): JsonValue;
export function customDefinitions(
  schema: JsonObject[],
  timeTracking: JsonObject | null,
): JsonObject[];
export function customPayload(
  definition: JsonObject | undefined,
  value: JsonValue,
): JsonObject;
