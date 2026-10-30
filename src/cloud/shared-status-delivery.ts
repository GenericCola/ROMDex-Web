import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { adoptTasks } from "./assigned-status";
import { assertDeliveryInputs, deliveryInputs } from "./delivery-inputs";
import { recordDelivery } from "./journal";
import { readRollupTree } from "./rollup-tree";
import { matchesStatusWrite, statusBase } from "./shared-status-protocol";
import type { SharedStatusWrite } from "./shared-status-types";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
export const sharedWrite = (
  operation: TaskOperation,
  remote: TaskItem,
  kind: "assign" | "rollup",
  value: string,
): SharedStatusWrite => {
  if (!remote.sharedStatus)
    throw Error("Read shared status before changing it.");
  return {
    schema: 1,
    opId: operation.opId,
    kind,
    value,
    expected: statusBase(remote.sharedStatus),
  };
};
export const saveStatusAttempt = (
  data: WorkspaceData,
  operation: TaskOperation,
  body: SharedStatusWrite | undefined,
) => {
  if (body) recordDelivery(data, operation.opId, { metadataWrite: body });
};
export const confirmStatusAttempt = (
  remote: TaskItem,
  write: SharedStatusWrite | undefined,
) => {
  if (
    write &&
    (!matchesStatusWrite(remote.sharedStatus, write) ||
      (write.kind === "assign" ? remote.assignedState : remote.state) !==
        write.value)
  )
    throw Error(
      "The exact shared-status write is not confirmed. No retry was sent.",
    );
};
export const refreshShared = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  if (!cloudData(snapshot()).sharedStatuses) return;
  if (!port.metadata)
    throw Error(
      "Shared status is enabled. Reconnect its compatible YouTrack app before delivery.",
    );
  await port.metadata.probe();
  const inputs = deliveryInputs(snapshot());
  const copy = structuredClone(snapshot());
  const tree = await readRollupTree(copy, port);
  await commit((data) => {
    assertDeliveryInputs(inputs, data);
    const comments = new Map(
      data.remote.map((item) => {
        return [item.id, item.comments];
      }),
    );
    data.cloud = { ...cloudData(copy), rollupPending: true };
    adoptTasks(
      data,
      tree.items.map((item) => {
        return { ...item, comments: comments.get(item.id) ?? item.comments };
      }),
    );
  });
};
