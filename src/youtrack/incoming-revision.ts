import type { TaskItem } from "@/domain/types";
import type { YouTrackRequest } from "./request";
export const incomingRevision = async (request: YouTrackRequest) => {
  const params = new URLSearchParams({
    fields: "idReadable,updated",
    $top: "10",
    query: "project: PMON sort by: updated desc",
  });
  const result: unknown = await request("issues?" + params.toString());
  if (!Array.isArray(result) || result.length > 10)
    throw Error("Incoming update check returned an invalid list.");
  const ids = new Set<string>();
  const revisions = result.map((entry: unknown) => {
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
    if (ids.has(entry.idReadable)) throw Error("Duplicate incoming revision.");
    ids.add(entry.idReadable);
    return `${entry.idReadable}:${entry.updated}`;
  });
  return revisions.sort().join("|");
};

export const snapshotRevision = (items: TaskItem[]) => {
  return [...items]
    .sort((a, b) => {
      return (b.updated ?? 0) - (a.updated ?? 0);
    })
    .slice(0, 10)
    .map((item) => {
      return `${item.id}:${item.updated}`;
    })
    .sort()
    .join("|");
};
