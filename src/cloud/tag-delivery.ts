import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { equal } from "./delivery-helpers";
import { recordDelivery } from "./journal";
import { tagIds, type TagPort, type TagStep } from "./tag-types";
import { cloudData, type Commit } from "./types";
type Edit = Extract<TaskOperation, { type: "edit" }>;
// Called only inside the operation's durable attempt. Never retries an ambiguous step.
export const deliverTags = async (
  operation: Edit,
  baseline: string[],
  desired: string[],
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: TagPort,
) => {
  if (cloudData(snapshot()).records[operation.opId]?.tagSteps?.length)
    throw Error(
      "Previous tag steps require explicit readback review, not replay.",
    );
  const target = tagIds(desired);
  if (!equal(target, tagIds(operation.patch.tags)))
    throw Error("Tag target differs from the reviewed operation.");
  let current = tagIds(baseline);
  const steps = [
    ...current
      .filter((id) => {
        return !target.includes(id);
      })
      .map((tagId) => {
        return { tagId, action: "remove" as const };
      }),
    ...target
      .filter((id) => {
        return !current.includes(id);
      })
      .map((tagId) => {
        return { tagId, action: "add" as const };
      }),
  ];
  const assertOperation = (data: WorkspaceData) => {
    if (
      !equal(
        data.operations.find((op) => {
          return op.opId === operation.opId;
        }),
        operation,
      ) ||
      cloudData(data).records[operation.opId]?.status !== "attempting"
    )
      throw Error(
        "Tag delivery requires the unchanged durable operation attempt.",
      );
  };
  for (const next of steps) {
    assertOperation(snapshot());
    if (!equal(tagIds(await port.list(operation.issueId)), current))
      throw Error(
        "The visible tag set changed before delivery. Review both versions.",
      );
    const after =
      next.action === "add"
        ? tagIds([...current, next.tagId])
        : current.filter((id) => {
            return id !== next.tagId;
          });
    const step: TagStep = {
      ...next,
      before: current,
      after,
      status: "attempting",
    };
    await commit((data) => {
      assertOperation(data);
      const record = cloudData(data).records[operation.opId];
      recordDelivery(data, operation.opId, {
        tagSteps: [...(record?.tagSteps ?? []), step],
      });
    });
    assertOperation(snapshot());
    if (!equal(tagIds(await port.list(operation.issueId)), current))
      throw Error(
        "Tags changed after the durable claim. No further request was sent.",
      );
    assertOperation(snapshot());
    if (next.action === "add") await port.add(operation.issueId, next.tagId);
    else await port.remove(operation.issueId, next.tagId);
    if (!equal(tagIds(await port.list(operation.issueId)), after))
      throw Error("Tag readback differs. Keep the operation held for review.");
    await commit((data) => {
      assertOperation(data);
      const journal = cloudData(data).records[operation.opId]?.tagSteps;
      const last = journal?.at(-1);
      if (!journal || !equal(last, step))
        throw Error("Tag receipt journal changed.");
      recordDelivery(data, operation.opId, {
        tagSteps: [...journal.slice(0, -1), { ...step, status: "confirmed" }],
      });
    });
    current = after;
  }
};
