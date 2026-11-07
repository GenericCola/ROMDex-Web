import type { TaskItem } from "@/domain/types";
import type { YouTrackRequest } from "./request";
/*
 * One light read that tells whether anything in PMON changed: every issue's
 * id and update time. It catches edits, new issues, deletions and moves out of
 * the project, so the full read runs only when something did change.
 */
const LIMIT = 2000;
export type IncomingMarks = Map<string, number>;
export const incomingMarks = async (
  request: YouTrackRequest,
): Promise<IncomingMarks | null> => {
  const params = new URLSearchParams({
    fields: "idReadable,updated",
    $top: String(LIMIT),
    query: "project: PMON",
  });
  const result: unknown = await request("issues?" + params.toString());
  if (!Array.isArray(result))
    throw Error("Incoming update check returned an invalid list.");
  // Too many issues for one page: answer "unknown" so the full read runs.
  if (result.length >= LIMIT) return null;
  const marks: IncomingMarks = new Map();
  for (const entry of result as unknown[]) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("idReadable" in entry) ||
      !("updated" in entry) ||
      typeof entry.idReadable !== "string" ||
      !/^PMON-\d+$/.test(entry.idReadable) ||
      typeof entry.updated !== "number" ||
      !Number.isSafeInteger(entry.updated) ||
      entry.updated < 0
    )
      throw Error("Incoming update revision is invalid.");
    if (marks.has(entry.idReadable))
      throw Error("Duplicate incoming revision.");
    marks.set(entry.idReadable, entry.updated);
  }
  return marks;
};
/** Ids whose update time differs or that are new, and ids now gone. */
export const changedMarks = (items: TaskItem[], marks: IncomingMarks) => {
  const changed = new Set<string>(),
    removed = new Set<string>();
  for (const item of items)
    if (!marks.has(item.id)) removed.add(item.id);
    else if (marks.get(item.id) !== item.updated) changed.add(item.id);
  const known = new Set(
    items.map((item) => {
      return item.id;
    }),
  );
  for (const id of marks.keys()) if (!known.has(id)) changed.add(id);
  return { changed, removed };
};
