import type { JsonObject } from "@/domain/json";
import type { YouTrackRequest } from "./request";
import { readTagChoices } from "./tags";
export const tagOptions = async (
  request: YouTrackRequest,
): Promise<JsonObject> => {
  try {
    return {
      ready: true,
      options: await readTagChoices(request),
      message:
        "Only existing tags are available. Changes are queued and verified individually.",
    };
  } catch {
    return {
      ready: false,
      options: [],
      message: "Tag choices could not be read. Existing tags are preserved.",
    };
  }
};
