import { customDefinitions } from "@/domain/accepted/custom-editor.mjs";
import { editorConfiguration } from "@/domain/accepted/item-editor.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { fieldType, id, users } from "./edit-option-values";
import { list, type YouTrackRequest } from "./request";
import { tagOptions } from "./tag-options";
const object = (value: unknown) => {
  return jsonObject(value as JsonObject);
};
export const readEditOptions = async (
  request: YouTrackRequest,
  expectedProject?: string,
) => {
  const projects = (
    await list<{ id: string; shortName: string }>(
      request,
      "admin/projects",
      "id,shortName",
      "PMON",
    )
  ).filter((project) => {
    return project.shortName === "PMON";
  });
  const project = projects[0];
  if (
    projects.length !== 1 ||
    !project ||
    !/^\d+-\d+$/.test(project.id) ||
    (expectedProject && project.id !== expectedProject)
  )
    throw Error("Cannot verify the selected PMON project.");
  const schema = await list<JsonObject>(
    request,
    `admin/projects/${project.id}/customFields`,
    "id,canBeEmpty,field(id,name,fieldType(id,valueType,isMultiValue)),bundle(id)",
  );
  if (
    new Set(
      schema.map((spec) => {
        return id(spec.id);
      }),
    ).size !== schema.length
  )
    throw Error("Duplicate project field identities.");
  let eligible: JsonObject[] | null = null,
    userError = "",
    tracking: JsonObject | null = null;
  const unavailable = new Map<string, string>();
  for (const spec of schema) {
    const field = object(spec.field),
      type = object(field.fieldType),
      kind = fieldType(type.valueType ?? type.id).replace(/\[.*$/, ""),
      specId = id(spec.id);
    if (typeof field.name !== "string")
      throw Error("Invalid project field name.");
    if (
      ![
        "enum",
        "state",
        "build",
        "version",
        "ownedField",
        "group",
        "user",
      ].includes(kind)
    )
      continue;
    try {
      const bundle = object(spec.bundle);
      const values =
        kind === "user"
          ? await users(request, bundle)
          : await list<JsonObject>(
              request,
              `admin/projects/${project.id}/customFields/${specId}/bundle/values`,
              "id,name",
            );
      if (
        values.some((value) => {
          return (
            typeof value.id !== "string" ||
            !value.id ||
            !(typeof value.name === "string" || typeof value.login === "string")
          );
        })
      )
        throw Error("Invalid project choices.");
      spec.bundle = {
        ...bundle,
        [kind === "user" ? "aggregatedUsers" : "values"]: values,
      };
      if (field.name === "Assignee") eligible = values;
    } catch {
      unavailable.set(
        specId,
        "Project choices could not be read. Existing values are preserved.",
      );
      if (field.name === "Assignee")
        userError = "Eligible assignees could not be read.";
    }
  }
  try {
    tracking = object(
      await request(
        `admin/projects/${project.id}/timeTrackingSettings?fields=enabled,timeSpent(id,field(id,name))`,
      ),
    );
  } catch {
    /* Calculated period fields remain read-only if designation is unknown. */
  }
  const custom = customDefinitions(schema, tracking).map((definition) => {
    const message =
      unavailable.get(id(definition.id)) ??
      (definition.multi === true && definition.choices !== true
        ? "This field cardinality is read-only in ROMDex."
        : undefined);
    return message || (!tracking && definition.type === "period")
      ? {
          ...definition,
          readOnly: true,
          message:
            message ?? "Time-tracking designation could not be verified.",
        }
      : definition;
  });
  return {
    projectId: project.id,
    schema,
    options: {
      ...editorConfiguration(schema, eligible, userError),
      custom,
      tags: await tagOptions(request),
    } as JsonObject,
  };
};
