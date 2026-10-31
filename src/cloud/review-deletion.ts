import type { TaskItem, WorkspaceData } from "@/domain/types";
import type { Deletion } from "./deletion-checks";
import {
  readDeletion,
  remainingDeletion,
  sameDeletion,
} from "./deletion-checks";
import { reconcileDeleted } from "./deletion-reconcile";
import { replaceRemote } from "./delivery-helpers";
import { acknowledge, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
export const reviewDeletion = async (
  data: WorkspaceData,
  operation: Deletion,
  choice: "cloud" | "local" | "confirm",
  commit: Commit,
  port: DeliveryPort,
  missingAcknowledged = false,
) => {
  const record = cloudData(data).records[operation.opId];
  if (!record) throw Error("No deletion result to review.");
  if (choice === "confirm") {
    if (!missingAcknowledged)
      throw Error(
        "Explicitly acknowledge that a missing task can mean lost access before confirming this deletion.",
      );
    const ids =
      record.status === "conflict"
        ? remainingDeletion(data, operation)
        : record.targetId && operation.ids.includes(record.targetId)
          ? [record.targetId]
          : [];
    if (!ids.length) throw Error("No missing deletion targets to confirm.");
    await reconcileDeleted(data, operation, commit, port, new Set(ids));
    return;
  }
  const ids = remainingDeletion(data, operation);
  if (choice === "cloud") {
    const items: TaskItem[] = [];
    for (const id of ids) {
      const item = await port.get(id);
      if (item) items.push(item);
    }
    await commit((next) => {
      for (const item of items) replaceRemote(next, item);
      acknowledge(next, operation);
      recordDelivery(next, operation.opId, {
        message:
          "Remaining deletion explicitly stopped; confirmed earlier deletions were not undone.",
      });
    });
    return;
  }
  const items = await readDeletion(ids, port);
  const shown = {
    ...operation.bases,
    ...Object.fromEntries(
      (record.remoteTasks ?? []).map((item) => {
        return [item.id, item];
      }),
    ),
  };
  if (
    items.some((item) => {
      return !sameDeletion(shown[item.id], item);
    })
  ) {
    await commit((next) => {
      recordDelivery(next, operation.opId, {
        status: "conflict",
        remoteTasks: items,
        message:
          "Deletion targets changed again. Review the new snapshot before approving.",
      });
    });
    throw Error(
      "Deletion targets changed again. Review the new snapshot before approving.",
    );
  }
  await commit((next) => {
    const queued = next.operations.find((op) => {
      return op.opId === operation.opId;
    });
    if (queued?.type !== "delete") throw Error("Deletion no longer pending.");
    queued.bases = {
      ...queued.bases,
      ...Object.fromEntries(
        items.map((item) => {
          return [item.id, item];
        }),
      ),
    };
    recordDelivery(next, operation.opId, {
      status: "ready",
      remoteTasks: items,
      message:
        "Remaining listed targets explicitly reviewed. Save runs a new check before deleting.",
    });
  });
};
