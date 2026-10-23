import { validateTask } from "@/domain/validate-task";
import type { RawIssue } from "./read-tasks";
import { normalize } from "./read-tasks";
import type { YouTrackRequest } from "./request";
import { list } from "./request";
export const readDeliveryTasks = async (request: YouTrackRequest) => {
  const raw = await list<RawIssue>(
    request,
    "issues",
    "id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(name,value(name,id,login,fullName)),commentsCount",
    "project: PMON sort by: created asc",
  );
  return raw.map((issue) => {
    const stateValue = issue.customFields?.find((field) => {
      return field.name === "State";
    })?.value;
    const state = Array.isArray(stateValue) ? undefined : stateValue?.name;
    if (typeof state !== "string" || !state)
      throw Error(
        "A native State value is unreadable. Status rollups were stopped.",
      );
    const item = normalize(issue);
    validateTask(item);
    return item;
  });
};
