import { youTrackState } from "@/domain/accepted/core.mjs";
import { nativeEditKey } from "@/domain/native-edit-fields";
import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { planReceipt } from "@/rdx/plan-ledger";
import { creationFollowup } from "./creation-followup";
import { equal } from "./delivery-helpers";
import { nativeTagBaseline } from "./edit-patch-delivery";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
type Creation = Extract<TaskOperation, { type: "create" }>;
export const matchesCreation = (item: TaskItem, remote: TaskItem) => {
  const mappedType = remote._custom?.some((field) => {
    return (
      field.name === "Type" &&
      typeof field.id === "string" &&
      Object.hasOwn(item, `custom:${field.id}`)
    );
  });
  return [
    "summary",
    "description",
    "state",
    "priority",
    "complexity",
    ...(mappedType ? [] : ["type"]),
    ...Object.keys(item).filter(nativeEditKey),
  ].every((key) => {
    return equal(
      key === "state"
        ? youTrackState(item.assignedState ?? item.state)
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
  for (const map of [data.commentDrafts, data.titleDrafts, data.images ?? {}]) {
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
  for (const map of [
    data.order,
    data.commentDrafts,
    data.titleDrafts,
    data.images ?? {},
  ]) {
    if (Object.hasOwn(map, old)) {
      Object.assign(map, { [remote.id]: map[old] });
      delete map[old];
    }
  }
  data.view.selected = id(data.view.selected);
  if (data.view.renameId !== undefined)
    data.view.renameId = id(data.view.renameId);
  data.view.scope = id(data.view.scope);
  data.view.expanded = data.view.expanded.map((entry) => {
    return entry === old ? remote.id : entry;
  });
  data.view.selectorExpanded = data.view.selectorExpanded.map((entry) => {
    return entry === old ? remote.id : entry;
  });
  if (data.newTask) {
    data.newTask.parentId = id(data.newTask.parentId);
    if (data.newTask.afterId !== undefined)
      data.newTask.afterId = id(data.newTask.afterId);
  }
  const parentId = id(operation.item.parentId);
  const followup = creationFollowup(operation, remote, parentId);
  if (followup) data.operations.unshift(followup);
  planReceipt(data, operation.opId, { [old]: remote.id }, followup?.opId);
};
export const deliverCreation = async (
  operation: Creation,
  commit: Commit,
  port: DeliveryPort,
) => {
  if (!operation.issueId.startsWith("local-"))
    throw Error("Creation needs a browser-local ID.");
  if (operation.item.tags !== undefined && !port.tags?.prepare)
    throw Error(
      "Creation tags require native tag preparation before creating the task.",
    );
  await port.prepareCreate(operation.item);
  await attemptDelivery(operation, commit, async () => {
    const receipt = await port.create(operation.item);
    if (!/^PMON-\d+$/.test(receipt.id))
      throw Error("Invalid creation receipt.");
    await commit((data) => {
      recordDelivery(data, operation.opId, { remoteId: receipt.id });
    });
    const readback = await port.get(receipt.id);
    const remote = readback
      ? await nativeTagBaseline(operation, readback, port)
      : null;
    if (!remote || !matchesCreation(operation.item, remote))
      throw Error("Creation readback differs.");
    await commit((data) => {
      completeCreation(data, operation, remote);
    });
  });
};
