import type { UploadStore } from "@/attachments/types";
import { batchOperationIds } from "@/domain/delivery-locks";
import type { WorkspaceData } from "@/domain/types";
import { seedAssigned } from "./assigned-status";
import { cancelLocalDeletions } from "./cancel-local-deletions";
import { creationDependency } from "./creation-dependency";
import {
  assertNoBlockedDeletion,
  blockedByDeletion,
} from "./deletion-isolation";
import { assertDeliveryInputs } from "./delivery-inputs";
import { deliveryPreflight } from "./delivery-preflight";
import { dispatchOperation } from "./dispatch-operation";
import { assertNoBlockedReview, blockedByReview } from "./review-isolation";
import { planRollup } from "./rollup";
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
  while (snapshot().operations.length || cloudData(snapshot()).rollupPending) {
    if (!keepGoing()) return;
    for (const op of snapshot().operations)
      if (blockedByDeletion(op, snapshot()) || blockedByReview(op, snapshot()))
        batch.delete(op.opId);
    if (
      snapshot().operations.length &&
      !snapshot().operations.some((op) => {
        return batch.has(op.opId);
      })
    ) {
      if (!selected && cloudData(snapshot()).rollupPending) {
        const planned = await planRollup(snapshot, commit, port);
        for (const id of planned.createdIds) initial.add(id);
        if (planned.operationId) {
          batch.add(planned.operationId);
          continue;
        }
      }
      assertNoBlockedDeletion(snapshot());
      assertNoBlockedReview(snapshot());
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
      assertNoBlockedReview(snapshot());
      return;
    }
    const planned = !snapshot().operations.length
      ? await planRollup(snapshot, commit, port)
      : undefined;
    for (const id of planned?.createdIds ?? []) initial.add(id);
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
    const dependency = selected
      ? undefined
      : creationDependency(snapshot(), first);
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
    await dispatchOperation(
      operation,
      snapshot,
      commit,
      port,
      uploads,
      planned,
    );
  }
};
