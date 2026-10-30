import type { JsonObject } from "@/domain/json";
import { list, type YouTrackRequest } from "./request";
export const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[-\w]{1,100}$/.test(value))
    throw Error("Invalid project field identity.");
  return value;
};
export const fieldType = (value: unknown): string => {
  if (typeof value !== "string") throw Error("Invalid native field type.");
  return value;
};
export const users = async (request: YouTrackRequest, bundle: JsonObject) => {
  const values = await list<JsonObject>(
    request,
    `admin/customFieldSettings/bundles/user/${id(bundle.id)}/aggregatedUsers`,
    "id,login,name,fullName",
  );
  if (
    values.some((user) => {
      return (
        typeof user.id !== "string" ||
        !user.id ||
        typeof user.login !== "string" ||
        !user.login
      );
    })
  )
    throw Error("Invalid eligible assignees.");
  return values;
};
