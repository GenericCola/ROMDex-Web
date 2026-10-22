import type { TaskItem } from "@/domain/types";
import type { YouTrackRequest } from "./request";
import { issueId, list } from "./request";
interface Link {
  id: string;
  direction: string;
  linkType: { name: string };
  issues?: { id: string; idReadable: string }[];
}
export const childrenOf = async (request: YouTrackRequest, id: string) => {
  const links = await list<Link>(
    request,
    "issues/" + issueId(id) + "/links",
    "id,direction,linkType(name)",
  );
  const outward = links.filter((link) => {
    return link.linkType?.name === "Subtask" && link.direction === "OUTWARD";
  });
  if (outward.length !== 1 || !outward[0] || !/^\d+-\d+s$/.test(outward[0].id))
    throw Error("Cannot verify the task's child link.");
  const items = await list<{ idReadable: string }>(
    request,
    "issues/" + id + "/links/" + outward[0].id + "/issues",
    "idReadable",
  );
  return items.map((item) => {
    return issueId(item.idReadable);
  });
};
export const changeParent = async (
  request: YouTrackRequest,
  get: (id: string) => Promise<TaskItem | null>,
  id: string,
  parentId: string | null,
  expected?: string | null,
) => {
  issueId(id);
  let parent = parentId;
  const seen = new Set([id]);
  while (parent) {
    issueId(parent);
    if (seen.has(parent))
      throw Error("The destination would create a hierarchy cycle.");
    seen.add(parent);
    const item = await get(parent);
    if (!item) throw Error("The destination ancestor is not readable.");
    parent = item.parentId;
  }
  const current = await get(id);
  if (!current) throw Error("The task is not readable.");
  if (current.parentId === parentId) return;
  if (expected !== undefined && current.parentId !== expected)
    throw Error("The parent changed before delivery. Review before moving.");
  const links = await list<Link>(
    request,
    "issues/" + id + "/links",
    "id,direction,linkType(name)",
  );
  const inward = links.filter((link) => {
    return link.linkType?.name === "Subtask" && link.direction === "INWARD";
  });
  const link = inward[0];
  if (inward.length !== 1 || !link || !/^\d+-\d+t$/.test(link.id))
    throw Error("Cannot verify the task's parent link.");
  const linked = await list<{ id: string; idReadable: string }>(
    request,
    "issues/" + id + "/links/" + link.id + "/issues",
    "id,idReadable",
  );
  if (linked.length > 1 || (linked[0]?.idReadable ?? null) !== current.parentId)
    throw Error("The parent relationship changed. Read again before moving.");
  const target = parentId ? await get(parentId) : null;
  if (parentId && (!target?.dbId || !/^\d+-\d+$/.test(target.dbId)))
    throw Error("Cannot verify the destination task.");
  if (linked[0]) {
    if (!/^\d+-\d+$/.test(linked[0].id))
      throw Error("Invalid parent database ID.");
    await request(
      "issues/" + id + "/links/" + link.id + "/issues/" + linked[0].id,
      "DELETE",
    );
    if ((await get(id))?.parentId !== null)
      throw Error("Parent removal was not confirmed.");
  }
  if (target)
    await request("issues/" + id + "/links/" + link.id + "/issues", "POST", {
      id: target.dbId,
    });
  if ((await get(id))?.parentId !== parentId)
    throw Error("New parent was not confirmed.");
};
