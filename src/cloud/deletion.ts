import type { TaskItem, WorkspaceData } from "@/domain/types";
import { errorText } from "@utils/error-text";
import type { Deletion } from "./deletion-checks";
import {
  readDeletion,
  remainingDeletion,
  sameDeletion,
} from "./deletion-checks";
import { DeletionReviewRequired } from "./deletion-isolation";
import { reconcileDeleted } from "./deletion-reconcile";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
export type { Deletion } from "./deletion-checks";
export const deliverDeletion = async (
  operation: Deletion,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  await reconcileDeleted(snapshot(), operation, commit, port);
  const ids = remainingDeletion(snapshot(), operation);
  if (!ids.length) {
    await commit((data) => {
      acknowledge(data, operation);
    });
    return;
  }
  let items: TaskItem[];
  try {
    items = await readDeletion(ids, port);
  } catch (error) {
    if (!(error instanceof DeletionReviewRequired)) throw error;
    await commit((data) => {
      recordDelivery(data, operation.opId, {
        status: "conflict",
        message: errorText(error, "Deletion needs review."),
      });
    });
    throw error;
  }
  for (const item of items) {
    const base = operation.bases?.[item.id];
    if (!sameDeletion(base, item)) {
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          message:
            "Deletion targets changed or lack a reviewed baseline. Review current tasks before approving deletion.",
          remoteTasks: items,
        });
      });
      throw new DeletionReviewRequired(
        "Review changed deletion targets. Nothing further was deleted.",
      );
    }
  }
  // Delete leaves first; each receipt is durable before moving to the next listed task.
  while (remainingDeletion(snapshot(), operation).length) {
    const remaining = remainingDeletion(snapshot(), operation);
    let leaf: TaskItem | undefined;
    for (const id of remaining) {
      const children = await port.children(id);
      if (!children.length) {
        leaf = (await port.get(id)) ?? undefined;
        break;
      }
    }
    const base = leaf ? operation.bases?.[leaf.id] : undefined;
    if (!leaf || !sameDeletion(base, leaf)) {
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          message:
            "The next deletion target changed or gained children. Review remaining tasks.",
          ...(leaf ? { remoteTasks: [leaf] } : {}),
        });
      });
      throw new DeletionReviewRequired(
        "Review changed deletion targets. Nothing further was deleted.",
      );
    }
    const target = leaf;
    await attemptDelivery(
      operation,
      commit,
      async () => {
        if ((await port.children(target.id)).length)
          throw Error("A new child blocks deletion.");
        await port.remove(target.id);
        await commit((data) => {
          const prior = cloudData(data).records[operation.opId];
          recordDelivery(data, operation.opId, {
            deleteReceipts: [...(prior?.deleteReceipts ?? []), target.id],
          });
        });
        if (await port.get(target.id))
          throw Error("Deletion readback still exists.");
        await commit((data) => {
          const prior = cloudData(data).records[operation.opId];
          recordDelivery(data, operation.opId, {
            deletedIds: [...(prior?.deletedIds ?? []), target.id],
          });
          data.remote = data.remote.filter((item) => {
            return item.id !== target.id;
          });
          if (!remainingDeletion(data, operation).length)
            acknowledge(data, operation);
        });
      },
      target.id,
    );
  }
};
