import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { equal } from "./delivery-helpers";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
type Creation = Extract<TaskOperation, { type: "create" }>;
export const matchesCreation = (item: TaskItem, remote: TaskItem) => {
  return [
    "summary",
    "description",
    "state",
    "priority",
    "complexity",
    "type",
  ].every((key) => {
    return equal(
      key === "state"
        ? (item.assignedState ?? item.state)
        : item[key as keyof TaskItem],
      remote[key as keyof TaskItem],
    );
  });
};
export const completeCreation = (
  data: WorkspaceData,
  operation: Creation,
  remote: TaskItem,
) => {
  const old = operation.issueId;
  for (const map of [data.commentDrafts, data.titleDrafts]) {
    if (
      Object.hasOwn(map, old) &&
      Object.hasOwn(map, remote.id) &&
      map[old] !== map[remote.id]
    )
      throw Error(
        "Both IDs have different drafts. Export recovery and review before mapping.",
      );
  }
  const id = (value: string | null) => {
    return value === old ? remote.id : value;
  };
  acknowledge(data, operation, remote);
  recordDelivery(data, operation.opId, { remoteId: remote.id });
  for (const op of data.operations) {
    if (op.issueId === old) op.issueId = remote.id;
    if (op.type === "create") {
      op.item.id = op.issueId;
      op.item.parentId = id(op.item.parentId);
    }
    if (op.type === "edit") {
      op.base.id = op.issueId;
      op.base.parentId = id(op.base.parentId);
      if (op.patch.parentId !== undefined)
        op.patch.parentId = id(op.patch.parentId);
    }
    if (op.type === "delete") {
      op.ids = op.ids.map((entry) => {
        return entry === old ? remote.id : entry;
      });
      if (op.bases?.[old]) {
        op.bases[remote.id] = { ...op.bases[old], id: remote.id };
        delete op.bases[old];
      }
      for (const base of Object.values(op.bases ?? {}))
        base.parentId = id(base.parentId);
    }
  }
  for (const map of [data.order, data.commentDrafts, data.titleDrafts]) {
    if (Object.hasOwn(map, old)) {
      Object.assign(map, { [remote.id]: map[old] });
      delete map[old];
    }
  }
  data.view.selected = id(data.view.selected);
  data.view.scope = id(data.view.scope);
  data.view.expanded = data.view.expanded.map((entry) => {
    return entry === old ? remote.id : entry;
  });
  data.view.selectorExpanded = data.view.selectorExpanded.map((entry) => {
    return entry === old ? remote.id : entry;
  });
  if (data.newTask) data.newTask.parentId = id(data.newTask.parentId);
  const parentId = id(operation.item.parentId);
  if (remote.parentId !== parentId)
    data.operations.unshift({
      opId: operation.opId + ":parent",
      type: "edit",
      issueId: remote.id,
      base: remote,
      patch: { parentId },
    });
};
export const deliverCreation = async (
  operation: Creation,
  commit: Commit,
  port: DeliveryPort,
) => {
  if (!operation.issueId.startsWith("local-"))
    throw Error("Creation needs a browser-local ID.");
  await port.prepareCreate(operation.item);
  await attemptDelivery(operation, commit, async () => {
    const receipt = await port.create(operation.item);
    if (!/^PMON-\d+$/.test(receipt.id))
      throw Error("Invalid creation receipt.");
    await commit((data) => {
      recordDelivery(data, operation.opId, { remoteId: receipt.id });
    });
    const remote = await port.get(receipt.id);
    if (!remote || !matchesCreation(operation.item, remote))
      throw Error("Creation readback differs.");
    await commit((data) => {
      completeCreation(data, operation, remote);
    });
  });
};
