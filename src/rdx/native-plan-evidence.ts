import type { AttachmentPort } from "@/attachments/types";
import { equal } from "@/cloud/delivery-helpers";
import type { PlanPullEvidence } from "@/domain/accepted/rdx/plan-pull.mjs";
import type { TaskItem } from "@/domain/types";
import type { PlanLedger } from "./plan-ledger";
export interface NativePlanReader {
  issue: (id: string) => Promise<TaskItem | null>;
  comments: (id: string) => Promise<TaskItem["comments"]>;
  files: Pick<AttachmentPort, "list" | "download">;
}
// Full inventories, never search absence or partial embedded collections.
export const readNativePlanEvidence = async (
  ledger: PlanLedger,
  reader: NativePlanReader,
  assertCurrent: () => void,
) => {
  const started = Date.now();
  const check = () => {
    assertCurrent();
    if (Date.now() - started > 180000)
      throw Error(
        "Native review reached its read-time limit. The original plan was retained.",
      );
  };
  const ids = [
    ...new Set(
      Object.values(ledger.tasks)
        .filter((binding) => {
          return !binding.deleted;
        })
        .map((binding) => {
          return binding.issueId;
        }),
    ),
  ];
  if (ids.length > 100)
    throw Error("Review a smaller native plan scope (100 tasks maximum).");
  const remote: TaskItem[] = [],
    comments: NonNullable<PlanPullEvidence["comments"]> = {},
    files: NonNullable<PlanPullEvidence["files"]> = {};
  let total = 0;
  for (const id of ids) {
    check();
    if (!/^PMON-\d+$/.test(id))
      throw Error("Native plan review is limited to PMON.");
    const before = await reader.issue(id);
    check();
    if (before?.id !== id)
      throw Error("A bound native task is missing. Its plan was retained.");
    comments[id] = await reader.comments(id);
    const inventory = await reader.files.list(id);
    if (inventory.length > 100)
      throw Error("A native task has more than 100 attachments.");
    files[id] = [];
    for (const file of inventory) {
      check();
      if (
        !Number.isSafeInteger(file.size) ||
        file.size < 0 ||
        file.size > 50 * 1024 * 1024 ||
        total + file.size > 64 * 1024 * 1024
      )
        throw Error(
          "Native plan attachments exceed the bounded read budget. The plan was retained.",
        );
      const bytes = await reader.files.download(id, file);
      check();
      if (bytes.length !== file.size)
        throw Error("A native attachment changed during review.");
      total += bytes.length;
      files[id].push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        bytes,
      });
    }
    // Detect changes while inventories/bytes were read; never merge mixed snapshots.
    const after = await reader.issue(id);
    const finalFiles = await reader.files.list(id),
      finalComments = await reader.comments(id);
    check();
    if (
      !equal(before, after) ||
      !equal(inventory, finalFiles) ||
      !equal(comments[id], finalComments)
    )
      throw Error(
        "Native evidence changed during review. Refresh before accepting it.",
      );
    remote.push(before);
  }
  return { remote, comments, files };
};
