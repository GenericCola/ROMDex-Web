import { customPayload } from "@/domain/accepted/custom-editor.mjs";
import { dateTimestamp } from "@/domain/accepted/item-editor.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { nativeEditKey } from "@/domain/native-edit-fields";
import type { TaskPatch } from "@/domain/types";
export const nativeEditPayload = (
  patch: TaskPatch,
  options: JsonObject,
  fields?: { id: string; name: string; $type: string }[],
) => {
  const result: JsonObject[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!nativeEditKey(key)) continue;
    let payload: JsonObject;
    if (key.startsWith("custom:")) {
      const definitions = options.custom;
      if (!Array.isArray(definitions))
        throw Error("Project field options are unavailable.");
      const definition = definitions
        .map((entry) => {
          return jsonObject(entry);
        })
        .find((entry) => {
          return entry.key === key;
        });
      payload = customPayload(definition, value);
    } else {
      const config = jsonObject(options[key]);
      if (config.ready !== true)
        throw Error("This native field is not available for editing.");
      if (value !== null && typeof value !== "string")
        throw Error("Invalid native field value.");
      if (value === null && config.canBeEmpty !== true)
        throw Error("This native field cannot be empty.");
      if (key === "assignee") {
        if (
          value !== null &&
          (!Array.isArray(config.options) ||
            !config.options.some((entry) => {
              return jsonObject(entry).id === value;
            }))
        )
          throw Error("Choose an eligible project assignee.");
        payload = {
          name: "Assignee",
          $type: "SingleUserIssueCustomField",
          value: value === null ? null : { id: value },
        };
      } else
        payload = {
          name: "Due Date",
          $type: "DateIssueCustomField",
          value: dateTimestamp(value),
        };
    }
    if (fields) {
      const matches = fields.filter((field) => {
        return payload.id
          ? field.id === payload.id
          : field.name === payload.name;
      });
      const matched = matches[0];
      if (matches.length !== 1 || !matched || matched.$type !== payload.$type)
        throw Error(
          "Native field configuration changed. Reopen and review the item.",
        );
      payload.id = matched.id;
    }
    result.push(payload);
  }
  return result;
};
