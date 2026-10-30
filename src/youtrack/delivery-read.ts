import { validateTask } from "@/domain/validate-task";
import { nativeIssueFields, nativeObject } from "./native-task-fields";
import type { RawIssue } from "./read-tasks";
import { normalize } from "./read-tasks";
import type { YouTrackRequest } from "./request";
import { list } from "./request";
export const readDeliveryTasks = async (request: YouTrackRequest) => {
  const raw = await list<RawIssue>(
    request,
    "issues",
    nativeIssueFields,
    "project: PMON sort by: created asc",
  );
  return raw.map((issue) => {
    const stateValue = issue.customFields?.find((field) => {
      return field.name === "State";
    })?.value;
    const state = nativeObject(stateValue)?.name;
    if (typeof state !== "string" || !state)
      throw Error(
        "A native State value is unreadable. Status rollups were stopped.",
      );
    const item = normalize(issue);
    validateTask(item);
    return item;
  });
};
