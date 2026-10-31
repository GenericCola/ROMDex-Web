import type { TaskItem } from "@/domain/types";
// Called only after ticket/hierarchy holds and snapshot validation. Equal-version
// data cannot replace editable fields; it can fill previously unknown read metadata.
export const acceptIncomingRevision = (
  previous: TaskItem | undefined,
  incoming: TaskItem,
  observed: number | null | undefined,
) => {
  const revision = incoming.updated!;
  if (observed != null && revision < observed) return false;
  if (previous?.updated != null && revision <= previous.updated) {
    if (
      revision === previous.updated &&
      previous.dependencies === undefined &&
      incoming.dependencies !== undefined
    )
      previous.dependencies = incoming.dependencies;
    return false;
  }
  return true;
};
