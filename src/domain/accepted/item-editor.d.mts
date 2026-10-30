export function dateText(value: number | string | null): string | null;
export function dateTimestamp(value: string | null): number | null;
export function editorConfiguration(
  schema: import("../json").JsonObject[],
  users: import("../json").JsonObject[] | null,
  error?: string,
): import("../json").JsonObject;
