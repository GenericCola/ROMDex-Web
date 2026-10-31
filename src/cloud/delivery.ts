import type { UploadStore } from "@/attachments/types";
import { batchOperationIds } from "@/domain/delivery-locks";
import type { WorkspaceData } from "@/domain/types";
import { seedAssigned } from "./assigned-status";
import { deliverAttachment } from "./attachment-delivery";
import { cancelLocalDeletions } from "./cancel-local-deletions";
import { deliverCreation } from "./creation";
import { creationDependency } from "./creation-dependency";
import { deliverDeletion } from "./deletion";
import {
  assertNoBlockedDeletion,
  blockedByDeletion,
  DeletionReviewRequired,
} from "./deletion-isolation";
import { assertDeliveryInputs } from "./delivery-inputs";
import { deliveryPreflight } from "./delivery-preflight";
import { deliverExisting } from "./existing-delivery";
import { deliverRollup, planRollup } from "./rollup";
import { refreshShared } from "./shared-status-delivery";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
import { validateQueue } from "./validation";
export const deliverQueue = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
  uploads?: UploadStore,
  keepGoing: () => boolean = () => {
    return true;
  },
  selected?: Set<string>,
) => {
  validateQueue(snapshot());
  const initial = new Set(
    snapshot().operations.map((op) => {
      return op.opId;
    }),
  );
  const batch = batchOperationIds(snapshot(), selected);
  await deliveryPreflight(snapshot, commit, port);
  await commit((data) => {
    if (!selected) cancelLocalDeletions(data);
    seedAssigned(data);
    data.cloud = { ...cloudData(data), accountId: port.accountId };
  });
  await refreshShared(snapshot, commit, port);
  while (snapshot().operations.length || cloudData(snapshot()).rollupPending) {
    if (!keepGoing()) return;
    for (const op of snapshot().operations)
      if (blockedByDeletion(op, snapshot())) batch.delete(op.opId);
    if (
      snapshot().operations.length &&
      !snapshot().operations.some((op) => {
        return batch.has(op.opId);
      })
    ) {
      assertNoBlockedDeletion(snapshot());
      return;
    }
    if (
      snapshot().operations.some((op) => {
        return !initial.has(op.opId) && !batch.has(op.opId);
      })
    )
      return;
    if (
      selected &&
      !snapshot().operations.some((op) => {
        return batch.has(op.opId);
      })
    ) {
      assertNoBlockedDeletion(snapshot());
      return;
    }
    const planned = !snapshot().operations.length
      ? await planRollup(snapshot, commit, port)
      : undefined;
    if (!keepGoing()) return;
    const first =
      snapshot().operations.find((op) => {
        return batch.has(op.opId);
      }) ?? (!selected ? snapshot().operations[0] : undefined);
    if (!first) return;
    if (planned?.operationId) batch.add(planned.operationId);
    if (
      snapshot().operations.some((op) => {
        return !initial.has(op.opId) && !batch.has(op.opId);
      })
    )
      return;
    if (planned) assertDeliveryInputs(planned.inputs, snapshot());
    const dependency = selected ? undefined : creationDependency(snapshot());
    if (dependency && dependency !== first.opId) {
      await commit((data) => {
        const index = data.operations.findIndex((op) => {
          return op.opId === dependency;
        });
        const [parent] = data.operations.splice(index, 1);
        if (!parent) throw Error("Creation dependency disappeared.");
        data.operations.unshift(parent);
      });
      continue;
    }
    const operation = structuredClone(first);
    const record = cloudData(snapshot()).records[operation.opId];
    if (record?.status === "attempting" || record?.status === "uncertain")
      throw Error(
        "An earlier request has an uncertain result. Review it before sending more changes.",
      );
    if (record?.status === "conflict")
      throw Error("Review the conflicting operation before continuing.");
    if (
      operation.type === "create" ||
      operation.type === "delete" ||
      (operation.type === "edit" &&
        (operation.patch.state !== undefined ||
          operation.patch.assignedState !== undefined ||
          operation.patch.parentId !== undefined))
    )
      await commit((data) => {
        data.cloud = { ...cloudData(data), rollupPending: true };
      });
    if (
      operation.type === "attachment" ||
      operation.type === "attachment-delete"
    ) {
      await deliverAttachment(operation, commit, port, uploads);
      continue;
    }
    if (operation.type === "create") {
      await deliverCreation(operation, commit, port);
      continue;
    }
    if (operation.type === "delete") {
      try {
        await deliverDeletion(operation, snapshot, commit, port);
      } catch (error) {
        if (!(error instanceof DeletionReviewRequired)) throw error;
      }
      continue;
    }
    if (operation.type === "edit" && operation.purpose === "rollup")
      await deliverRollup(operation, snapshot, commit, port, planned);
    else await deliverExisting(operation, snapshot, commit, port);
  }
};
