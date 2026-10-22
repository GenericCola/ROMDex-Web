import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { observeStatus } from "./assigned-status";
import { acknowledge, attemptDelivery } from "./journal";
import { readRollupTree } from "./rollup-tree";
import {
  confirmStatusAttempt,
  saveStatusAttempt,
  sharedWrite,
} from "./shared-status-delivery";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
type Edit = Extract<TaskOperation, { type: "edit" }>;
export const planRollup = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  const copy = structuredClone(snapshot());
  const tree = await readRollupTree(copy, port);
  await commit((data) => {
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
    if (tree.next)
      data.operations.push({
        opId: crypto.randomUUID(),
        type: "edit",
        purpose: "rollup",
        issueId: tree.next.id,
        base: tree.next,
        patch: {
          state: tree.desired(tree.next),
          assignedState: tree.next.assignedState ?? tree.next.state,
        },
      });
  });
  return tree;
};
export const deliverRollup = async (
  operation: Edit,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
  planned?: Awaited<ReturnType<typeof readRollupTree>>,
) => {
  const copy = structuredClone(snapshot());
  const tree = planned ?? (await readRollupTree(copy, port));
  const current = tree.items.find((item) => {
    return item.id === operation.issueId;
  });
  await commit((data) => {
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
  const fresh = await port.get(current.id);
  if (
    fresh?.state !== current.state ||
    fresh?.parentId !== current.parentId ||
    fresh.updated !== current.updated ||
    fresh.sharedStatus?.revision !== current.sharedStatus?.revision ||
    (current.sharedStatus !== undefined &&
      fresh.assignedState !== current.assignedState)
  )
    throw Error(
      "The rollup target changed. Refresh before sending its status.",
    );
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
