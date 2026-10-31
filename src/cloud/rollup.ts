import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { observeStatus } from "./assigned-status";
import { assertDeliveryInputs, deliveryInputs } from "./delivery-inputs";
import { acknowledge, attemptDelivery } from "./journal";
import { queueRollup } from "./rollup-operations";
import { readRollupTree } from "./rollup-tree";
import {
  confirmStatusAttempt,
  saveStatusAttempt,
  sharedWrite,
} from "./shared-status-delivery";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
import { availabilityFingerprint } from "./unavailable-tasks";
type Edit = Extract<TaskOperation, { type: "edit" }>;
export const planRollup = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  const inputs = deliveryInputs(snapshot());
  const copy = structuredClone(snapshot());
  const tree = await readRollupTree(copy, port);
  let operationId: string | undefined;
  const createdIds: string[] = [];
  let committedInputs = inputs;
  await commit((data) => {
    assertDeliveryInputs(inputs, data);
    data.cloud = {
      ...cloudData(data),
      assigned: cloudData(copy).assigned ?? {},
      rollupPending: !!tree.next,
    };
    data.remote = tree.items.map((item) => {
      const previous = data.remote.find((entry) => {
        return entry.id === item.id;
      });
      return { ...item, comments: previous?.comments ?? item.comments };
    });
    if (tree.unavailable.length || tree.missingIds.length)
      data.cloud.unavailable = {
        accountId: port.accountId,
        project: "PMON",
        tasks: tree.unavailable,
        missingIds: tree.missingIds,
        deniedIds: tree.deniedIds,
        linkedMissingIds: tree.linkedMissingIds,
        blockedIds: tree.blockedIds,
        fingerprint: availabilityFingerprint(
          data,
          tree.missingIds,
          tree.blockedIds,
        ),
      };
    else delete data.cloud.unavailable;
    for (const item of tree.deferred) {
      const id = queueRollup(data, item, tree.desired(item));
      if (id) createdIds.push(id);
    }
    if (tree.next)
      operationId = queueRollup(data, tree.next, tree.desired(tree.next));
    if (operationId) createdIds.push(operationId);
    data.cloud.rollupPending =
      !!tree.next ||
      data.operations.some((op) => {
        return op.type === "edit" && op.purpose === "rollup";
      });
    committedInputs = deliveryInputs(data);
  });
  return { ...tree, operationId, createdIds, inputs: committedInputs };
};
export const deliverRollup = async (
  operation: Edit,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
  planned?: Awaited<ReturnType<typeof readRollupTree>>,
) => {
  const inputs = deliveryInputs(snapshot());
  const copy = structuredClone(snapshot());
  const tree = planned ?? (await readRollupTree(copy, port));
  const current = tree.items.find((item) => {
    return item.id === operation.issueId;
  });
  await commit((data) => {
    assertDeliveryInputs(inputs, data);
    data.cloud = {
      ...cloudData(data),
      assigned: cloudData(copy).assigned ?? {},
    };
  });
  if (
    !current ||
    tree.next?.id !== current.id ||
    current.state === tree.desired(current) ||
    tree.desired(current) !== operation.patch.state ||
    current.assignedState !== operation.patch.assignedState
  ) {
    await commit((data) => {
      acknowledge(data, operation, current);
    });
    return;
  }
  const beforeFresh = deliveryInputs(snapshot());
  const fresh = await port.get(current.id);
  assertDeliveryInputs(beforeFresh, snapshot());
  if (
    fresh?.state !== current.state ||
    fresh?.parentId !== current.parentId ||
    fresh.updated !== current.updated ||
    fresh.sharedStatus?.revision !== current.sharedStatus?.revision ||
    (current.sharedStatus !== undefined &&
      fresh.assignedState !== current.assignedState)
  )
    throw Error("The status target changed. Refresh before sending.");
  const { state } = operation.patch;
  if (!state) throw Error("Missing effective status.");
  const metadata = cloudData(snapshot()).sharedStatuses
    ? sharedWrite(operation, fresh, "rollup", state)
    : undefined;
  await attemptDelivery(
    operation,
    commit,
    async () => {
      if (metadata) {
        if (!port.metadata)
          throw Error("Shared-status delivery is unavailable.");
        await port.metadata.write(current.id, metadata);
      } else await port.update(current.id, { state }, fresh);
      const received = await port.get(current.id);
      if (!received || received.state !== operation.patch.state)
        throw Error("Effective status was not confirmed.");
      confirmStatusAttempt(received, metadata);
      await commit((data) => {
        const verified = observeStatus(data, received);
        if (verified.assignedState !== operation.patch.assignedState)
          throw Error("Assigned status changed during rollup.");
        acknowledge(data, operation, verified);
      });
    },
    current.id,
    (data) => {
      const record = cloudData(data).assigned?.[current.id];
      if (!record || !operation.patch.state)
        throw Error("Missing status observation.");
      record.pendingState = operation.patch.state;
      saveStatusAttempt(data, operation, metadata);
    },
  );
};
