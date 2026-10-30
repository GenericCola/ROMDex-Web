import { cookieFetch, isCookieHandle } from "@/auth/cookie-client";
import { authRequestGuard } from "@/auth/session";
import type { TaskItem } from "@/domain/types";
import { YouTrackHttpError } from "./http-error";
import {
  nativeIssueFields,
  nativeObject,
  nativeTaskFields,
  type NativeField,
} from "./native-task-fields";
export const YOUTRACK_ORIGIN = "https://thegobindsingh.youtrack.cloud";
export interface RawIssue {
  id: string;
  idReadable: string;
  summary: string;
  description: string | null;
  updated: number;
  project: { shortName: string };
  parent?: { issues?: { idReadable: string }[] };
  customFields?: NativeField[];
  tags?: { id: string; name: string }[];
  commentsCount?: number;
}
export const normalize = (raw: RawIssue): TaskItem => {
  if (
    raw.project.shortName !== "PMON" ||
    !/^PMON-\d+$/.test(raw.idReadable) ||
    typeof raw.summary !== "string"
  )
    throw Error(
      "YouTrack returned an unexpected task. The browser workspace was not changed.",
    );
  const parents = raw.parent?.issues ?? [];
  if (parents.length > 1)
    throw Error(
      "A task has multiple parents. Resolve its hierarchy in YouTrack before importing.",
    );
  const value = (name: string) => {
    const value = raw.customFields?.find((field) => {
      return field.name === name;
    })?.value;
    const nameValue = nativeObject(value)?.name;
    return typeof nameValue === "string" ? nameValue : undefined;
  };
  return {
    ...nativeTaskFields(raw.customFields, raw.tags),
    id: raw.idReadable,
    dbId: raw.id,
    summary: raw.summary,
    description: raw.description ?? "",
    parentId: parents[0]?.idReadable ?? null,
    state: value("State") ?? "To do",
    assignedState: value("State") ?? "To do",
    priority: value("Priority") ?? "Normal",
    complexity: value("Complexity") ?? null,
    type: value("Type") ?? "Task",
    updated: raw.updated,
    comments: [],
    commentCount: raw.commentsCount ?? 0,
    url: YOUTRACK_ORIGIN + "/issue/" + raw.idReadable,
  };
};
export const readTasks = async (
  token: string,
  current: () => void = () => {
    return undefined;
  },
): Promise<TaskItem[]> => {
  const guard = authRequestGuard(token.trim());
  const assertCurrent = () => {
    guard();
    current();
  };
  if (!token.trim()) throw Error("Enter a YouTrack token in this window.");
  const items: TaskItem[] = [];
  for (let skip = 0; skip < 100000; skip += 100) {
    assertCurrent();
    const query = new URLSearchParams({
      query: "project: PMON sort by: created asc",
      fields: nativeIssueFields,
      $top: "100",
      $skip: String(skip),
    });
    let response: Response;
    try {
      response = isCookieHandle(token)
        ? await cookieFetch(
            token,
            "/api/youtrack?route=" +
              encodeURIComponent("issues?" + query.toString()),
          )
        : await fetch(YOUTRACK_ORIGIN + "/api/issues?" + query.toString(), {
            method: "GET",
            headers: {
              Authorization: "Bearer " + token.trim(),
              Accept: "application/json",
            },
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(30000),
          });
    } catch {
      throw Error(
        "YouTrack could not be reached. Check your connection and allow this app's origin in YouTrack CORS settings. No workspace data was replaced.",
      );
    }
    if (!response.ok) throw new YouTrackHttpError(response.status);
    const raw: unknown = await response.json();
    assertCurrent();
    if (!Array.isArray(raw))
      throw Error(
        "Unexpected YouTrack response. No workspace data was replaced.",
      );
    items.push(...(raw as RawIssue[]).map(normalize));
    if (raw.length < 100) return items;
  }
  throw Error(
    "The task read reached its safety limit. No workspace data was replaced.",
  );
};
