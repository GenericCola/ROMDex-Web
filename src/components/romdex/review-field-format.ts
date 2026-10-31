import type { TaskItem } from "@/domain/types";
export const reviewLabels: Record<string, string> = {
  summary: "Title",
  description: "Notes",
  state: "State",
  assignedState: "Assigned status",
  priority: "Priority",
  complexity: "Complexity",
  parentId: "Parent",
  type: "Task type",
  assignee: "Assignee",
  assignees: "Assignees",
  dueDate: "Due date",
  tags: "Tags",
  tagNames: "Tags",
};
export const reviewConcise = (value: string) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
};
const object = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
};
const definitions = (field: string, tasks: TaskItem[]) => {
  return tasks
    .flatMap((task) => {
      return task._custom ?? [];
    })
    .filter((entry) => {
      return field.startsWith("custom:")
        ? entry.id === field.slice(7)
        : entry.name === reviewLabels[field];
    });
};
export const reviewFieldLabel = (field: string, tasks: TaskItem[]) => {
  if (Object.hasOwn(reviewLabels, field)) return reviewLabels[field];
  const names = new Set(
    definitions(field, tasks)
      .map((entry) => {
        return entry.name;
      })
      .filter((name): name is string => {
        return typeof name === "string" && !!name;
      }),
  );
  return names.size === 1
    ? reviewConcise([...names][0] ?? "")
    : "Other task field" + (field.startsWith("custom:") ? ` (${field})` : "");
};
export const reviewFieldValue = (
  field: string,
  value: unknown,
  tasks: TaskItem[] = [],
): string => {
  if (value === undefined) return "not available";
  if (value === null || value === "") return "none";
  const fields = definitions(field, tasks);
  if (
    field === "description" ||
    fields.some((entry) => {
      return entry.$type === "TextIssueCustomField";
    })
  )
    return "content withheld";
  if (!Object.hasOwn(reviewLabels, field) && !field.startsWith("custom:"))
    return "content withheld";
  if (Array.isArray(value))
    return value.length
      ? value
          .slice(0, 20)
          .map((entry) => {
            return reviewFieldValue(field, entry, tasks);
          })
          .join(", ") +
          (value.length > 20 ? ` (+${value.length - 20} more)` : "")
      : "none";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "not available";
    if (
      field === "dueDate" ||
      fields.some((entry) => {
        return entry.$type === "DateIssueCustomField";
      })
    ) {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "not available"
        : date.toISOString().slice(0, 10);
    }
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  const raw = object(value);
  const identifier =
    typeof value === "string"
      ? value
      : typeof raw?.id === "string"
        ? raw.id
        : undefined;
  if (identifier === undefined) return "content withheld";
  const identifiers =
    ["tags", "tagNames", "assignee", "assignees"].includes(field) ||
    (field.startsWith("custom:") &&
      (!fields.length ||
        fields.some((entry) => {
          return /Enum|State|Build|Version|Owned|User|Group/.test(
            typeof entry.$type === "string" ? entry.$type : "",
          );
        })));
  if (!identifiers) return raw ? "content withheld" : reviewConcise(identifier);
  const options: unknown[] = fields.flatMap((entry) => {
    return Array.isArray(entry.value) ? entry.value : [entry.value];
  });
  for (const task of tasks) {
    if (field === "tags" || field === "tagNames")
      options.push(...(task.tagNames ?? []));
    if (field === "assignee" || field === "assignees")
      options.push(...(task.assignees ?? []));
  }
  if (raw) options.push(raw);
  const names = new Set<string>();
  for (const option of options) {
    const entry = object(option);
    if (entry?.id !== identifier) continue;
    const name: unknown = entry.fullName ?? entry.name ?? entry.login;
    if (typeof name === "string" && name.trim() && name !== identifier)
      names.add(name);
  }
  return names.size === 1
    ? reviewConcise([...names][0] ?? "")
    : `Unknown identifier ${reviewConcise(identifier)}`;
};
