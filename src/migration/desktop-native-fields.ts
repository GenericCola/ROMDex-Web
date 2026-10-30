import type { JsonObject, JsonValue } from "@/domain/json";
const object = (value: JsonValue | undefined) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
};
const nativeName = (raw: JsonObject, id: string) => {
  const field = (Array.isArray(raw._custom) ? raw._custom : [])
    .map(object)
    .find((entry) => {
      return entry?.name === "Assignee";
    });
  const value = field?.value;
  const people = Array.isArray(value) ? value : value == null ? [] : [value];
  const person = people.map(object).find((entry) => {
    return entry?.id === id;
  });
  const name = person?.fullName ?? person?.name ?? person?.login;
  return typeof name === "string" && name ? name : id;
};
// Preserve the desktop's known native values; the caller validates before import.
// Pending operations remain quarantined separately, never folded into this baseline.
export const desktopNativeFields = (raw: JsonObject) => {
  const fields = Object.fromEntries(
    Object.entries(raw).filter(([key]) => {
      return (
        [
          "assignee",
          "assignees",
          "dueDate",
          "tags",
          "tagNames",
          "_custom",
        ].includes(key) || key.startsWith("custom:")
      );
    }),
  );
  if (raw.assignees === undefined && raw.assignee !== undefined) {
    const people = Array.isArray(raw.assignee)
      ? raw.assignee
      : raw.assignee == null
        ? []
        : [raw.assignee];
    fields.assignees = people.map((id) => {
      if (typeof id !== "string" || !id)
        throw Error(
          "Invalid desktop assignee identity. Keep the original export.",
        );
      let name = nativeName(raw, id);
      if (
        people.length === 1 &&
        typeof raw.assigneeName === "string" &&
        raw.assigneeName
      )
        name = raw.assigneeName;
      return { id, name };
    });
  }
  return structuredClone(fields);
};
