import { HttpFailure } from "./runtime-types.ts";
// Incident 2026-10-30: remove only after this account's phone queue is reviewed.
// No timer: an old cached client must not silently regain write access.
export class HierarchyRecoveryConflict extends HttpFailure {
  constructor() {
    super(409);
  }
}
export async function guardHierarchyRecovery(
  userId: string,
  parts: string[],
  readLinks: () => Promise<unknown>,
) {
  if (userId !== "2-2" || parts[2] !== "links") return;
  const links = await readLinks();
  if (!Array.isArray(links)) throw new HttpFailure(502);
  const link = links.find((item) => item?.id === parts[3]);
  if (!link) throw new HttpFailure(409);
  if (link.linkType?.name === "Subtask") throw new HierarchyRecoveryConflict();
}
