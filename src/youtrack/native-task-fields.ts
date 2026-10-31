import { customValue } from "@/domain/accepted/custom-editor.mjs";
import { dateText } from "@/domain/accepted/item-editor.mjs";
import type { JsonValue } from "@/domain/json";
import type { TaskItem } from "@/domain/types";
export interface NativeField {
  id?: string;
  name: string;
  $type?: string;
  value?: JsonValue;
}
export const nativeObject = (value: JsonValue | undefined) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
};
export const nativeTaskFields = (
  fields: NativeField[] = [],
  tags: { id: string; name: string }[] = [],
): Pick<
  Required<TaskItem>,
  "_custom" | "assignees" | "assignee" | "dueDate" | "tags" | "tagNames"
> &
  Record<`custom:${string}`, JsonValue> => {
  const raw = fields.map((field) => {
    return {
      id: field.id ?? "",
      name: field.name,
      $type: field.$type ?? "",
      value: field.value ?? null,
    };
  });
  const person = fields.find((field) => {
    return field.name === "Assignee";
  })?.value;
  const people = (
    Array.isArray(person) ? person : person == null ? [] : [person]
  ).map((entry) => {
    const object = nativeObject(entry);
    if (!object) throw Error("Invalid native assignee.");
    return object;
  });
  const assignees = people.map((value) => {
    if (typeof value.id !== "string" || !value.id)
      throw Error("Invalid native assignee.");
    const label = value.fullName ?? value.login ?? value.name ?? value.id;
    if (typeof label !== "string") throw Error("Invalid native assignee name.");
    return { id: value.id, name: label };
  });
  const due = fields.find((field) => {
    return field.name === "Due Date";
  })?.value;
  if (due != null && (typeof due !== "number" || !Number.isFinite(due)))
    throw Error("Invalid native due date.");
  if (
    !Array.isArray(tags) ||
    tags.some((tag) => {
      return (
        typeof tag.id !== "string" || !tag.id || typeof tag.name !== "string"
      );
    })
  )
    throw Error("Invalid native tags.");
  const custom: Record<`custom:${string}`, JsonValue> = {};
  for (const field of raw)
    if (
      field.id &&
      !["State", "Priority", "Complexity", "Assignee", "Due Date"].includes(
        field.name,
      )
    )
      custom[`custom:${field.id}`] = customValue(field);
  return {
    ...custom,
    _custom: raw,
    assignees,
    assignee: Array.isArray(person)
      ? assignees.map((value) => {
          return value.id;
        })
      : (assignees[0]?.id ?? null),
    dueDate: due == null ? null : dateText(due),
    tags: [
      ...new Set(
        tags.map((tag) => {
          return tag.id;
        }),
      ),
    ].sort(),
    tagNames: tags,
  };
};
export const nativeIssueFields =
  "id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(id,name,$type,value(name,id,login,fullName,minutes,text)),tags(id,name),commentsCount,links(linkType(name),issues(id))";
