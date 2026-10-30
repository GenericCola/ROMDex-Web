import type { TaskItem } from "@/domain/types";
import { issueId, list, type YouTrackRequest } from "./request";
export const readComments = async (
  request: YouTrackRequest,
  issue: string,
): Promise<TaskItem["comments"]> => {
  const values = await list<{
    id: unknown;
    text: unknown;
    created: unknown;
    deleted: unknown;
    author?: { login?: unknown; fullName?: unknown } | null;
  }>(
    request,
    "issues/" + issueId(issue) + "/comments",
    "id,text,created,deleted,author(login,fullName)",
  );
  const ids = new Set<string>();
  return values.flatMap((value) => {
    if (
      typeof value.id !== "string" ||
      !/^\d+-\d+$/.test(value.id) ||
      ids.has(value.id) ||
      typeof value.deleted !== "boolean"
    )
      throw Error(
        "YouTrack returned an invalid comment inventory. The previous copy was kept.",
      );
    ids.add(value.id);
    if (value.deleted) return [];
    if (
      typeof value.text !== "string" ||
      typeof value.created !== "number" ||
      !Number.isSafeInteger(value.created) ||
      value.created < 0
    )
      throw Error(
        "YouTrack returned an invalid comment. The previous copy was kept.",
      );
    return [
      {
        id: value.id,
        text: value.text,
        created: value.created,
        author:
          typeof value.author?.fullName === "string"
            ? value.author.fullName
            : typeof value.author?.login === "string"
              ? value.author.login
              : "YouTrack User",
      },
    ];
  });
};
