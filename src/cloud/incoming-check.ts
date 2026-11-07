import type { TaskItem } from "@/domain/types";
import type { IncomingMarks } from "@/youtrack/incoming-revision";
import { changedMarks } from "@/youtrack/incoming-revision";
import { incomingStep } from "./incoming-error";
/** At most this many changed issues are read one by one; more means a full read. */
const SINGLE_READS = 10;
export interface IncomingClient {
  marks: () => Promise<IncomingMarks | null>;
  get: (id: string) => Promise<TaskItem | null>;
}
const issueNumber = (item: TaskItem) => {
  return Number(item.id.slice("PMON-".length));
};
/**
 * The cached issues brought up to date with one light read plus a read per
 * changed issue, or null when only a full read can tell.
 */
export const checkedItems = async (
  client: IncomingClient,
  cached: TaskItem[],
  current: () => void,
  /** This browser's saved copy of an issue, e.g. read back after delivery. */
  saved: (id: string) => TaskItem | undefined,
) => {
  const marks = await incomingStep("revision", client.marks);
  current();
  if (!marks) return null;
  const { changed, removed } = changedMarks(cached, marks);
  if (!changed.size && !removed.size) return cached;
  if (changed.size > SINGLE_READS) return null;
  const byId = new Map(
    cached
      .filter((item) => {
        return !removed.has(item.id);
      })
      .map((item) => {
        return [item.id, item] as const;
      }),
  );
  for (const id of changed) {
    // A delivery already read this version back: no need to read it again.
    const known = saved(id);
    const item =
      known && known.updated === marks.get(id)
        ? known
        : await incomingStep("tasks", () => {
            return client.get(id);
          });
    current();
    // Unreadable now (deleted or hidden since the light read): read everything.
    if (!item) return null;
    byId.set(id, item);
  }
  return [...byId.values()].sort((a, b) => {
    return issueNumber(a) - issueNumber(b);
  });
};
