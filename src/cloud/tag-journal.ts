import type { TaskOperation } from "@/domain/types";
import { equal } from "./delivery-helpers";
import { tagIds } from "./tag-types";
import type { DeliveryRecord } from "./types";
export const validateTagJournal = (
  record: DeliveryRecord,
  operation?: TaskOperation,
) => {
  if (record.tagSteps === undefined) return;
  if (
    !Array.isArray(record.tagSteps) ||
    operation?.type !== "edit" ||
    operation.patch.tags === undefined
  )
    throw Error("Invalid tag journal. Preserve recovery before continuing.");
  const target = tagIds(operation.patch.tags);
  const baseline = tagIds(operation.base.tags);
  let previous: string[] | null = null;
  for (const [index, step] of record.tagSteps.entries()) {
    if (
      !step ||
      !["add", "remove"].includes(step.action) ||
      !["attempting", "confirmed"].includes(step.status) ||
      (step.status === "attempting" && index !== record.tagSteps.length - 1)
    )
      throw Error("Invalid tag step evidence.");
    tagIds([step.tagId]);
    const before = tagIds(step.before),
      after = tagIds(step.after);
    if (
      (index === 0 && !equal(baseline, before)) ||
      (step.action === "add"
        ? !target.includes(step.tagId)
        : target.includes(step.tagId)) ||
      (previous && !equal(previous, before)) ||
      (step.action === "add"
        ? before.includes(step.tagId) ||
          !equal(after, tagIds([...before, step.tagId]))
        : !before.includes(step.tagId) ||
          !equal(
            after,
            before.filter((id) => {
              return id !== step.tagId;
            }),
          ))
    )
      throw Error(
        "Tag step evidence does not describe one exact membership change.",
      );
    previous = after;
  }
};
