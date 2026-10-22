import type { TaskItem, TaskPatch } from "@/domain/types";
import type { YouTrackRequest } from "./request";
import { list } from "./request";
export type Field = Record<"name" | "$type" | "id", string> & {
  value?: { name?: string } | null;
};
const names: Record<string, string> = {
  priority: "Priority",
  complexity: "Complexity",
  state: "State",
  type: "Type",
};
export const issueBody = (
  patch: TaskPatch & { type?: string },
  fields: Field[],
) => {
  if (patch.assignedState !== undefined)
    throw Error(
      "Assigned status must use the status journal before effective State delivery.",
    );
  const body: Record<string, unknown> = {};
  const customFields = new Map<string, unknown>();
  for (const [key, value] of Object.entries(patch)) {
    if (key === "summary" || key === "description") {
      body[key] = value;
      continue;
    }
    if (key === "parentId") continue;
    const name = names[key];
    const field = fields.find((candidate) => {
      return candidate.name === name;
    });
    const type =
      name === "State" ? "StateIssueCustomField" : "SingleEnumIssueCustomField";
    if (
      !name ||
      field?.$type !== type ||
      !field.id ||
      typeof field.id !== "string"
    )
      throw Error(
        "This field cannot be safely delivered with its current configuration.",
      );
    customFields.set(name, {
      id: field.id,
      name,
      $type: field.$type,
      value: value === null ? null : { name: value },
    });
  }
  if (customFields.size) body.customFields = [...customFields.values()];
  return body;
};
export const creationBody = async (
  request: YouTrackRequest,
  item: TaskItem,
) => {
  const projects = await list<{ id: string; shortName: string }>(
    request,
    "admin/projects",
    "id,shortName",
    "PMON",
  );
  const matches = projects.filter((project) => {
    return project.shortName === "PMON";
  });
  const project = matches[0];
  if (matches.length !== 1 || !project || !/^\d+-\d+$/.test(project.id))
    throw Error("Cannot verify the PMON project.");
  const schema = await list<{
    id: string;
    field: { name: string; fieldType: { id: string } };
  }>(
    request,
    "admin/projects/" + project.id + "/customFields",
    "id,field(name,fieldType(id))",
  );
  const fields = schema.map((entry) => {
    const type = entry.field?.fieldType?.id;
    return {
      id: entry.id,
      name: entry.field?.name,
      $type:
        type === "state[1]"
          ? "StateIssueCustomField"
          : type === "enum[1]"
            ? "SingleEnumIssueCustomField"
            : "unsupported",
    };
  });
  const body = issueBody(
    {
      summary: item.summary,
      description: item.description,
      state: item.assignedState ?? item.state,
      priority: item.priority,
      complexity: item.complexity,
      type: item.type,
    },
    fields,
  );
  return { ...body, project: { id: project.id } };
};
