import { reconcile } from "@/domain/accepted/core.mjs";
import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import {
  assignmentPatch,
  assignStatus,
  observeStatus,
} from "./assigned-status";
import { equal, supported } from "./delivery-helpers";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import {
  confirmStatusAttempt,
  saveStatusAttempt,
  sharedWrite,
} from "./shared-status-delivery";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
type Existing = Extract<TaskOperation, { type: "edit" | "comment" }>;
export const deliverExisting = async (
  operation: Existing,
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  if (
    !/^PMON-\d+$/.test(operation.issueId) ||
    (operation.type === "edit" && !supported(operation.patch))
  )
    throw Error(
      "Unsupported task operation remains queued. Nothing was sent for it.",
    );
  const received = await port.get(operation.issueId);
  if (!received)
    throw Error(
      "A queued task is no longer readable. Nothing was sent for it.",
    );
  const copy = structuredClone(snapshot());
  const remote = observeStatus(copy, received);
  await commit((data) => {
    data.cloud = cloudData(copy);
  });
  let patch = operation.type === "edit" ? assignmentPatch(operation.patch) : {};
  if (operation.type === "edit") {
    const base = {
      ...operation.base,
      assignedState: operation.base.assignedState ?? operation.base.state,
    };
    const result = reconcile(base, patch, remote);
    ({ patch } = result);
    if (
      cloudData(snapshot()).sharedStatuses &&
      patch.assignedState !== undefined &&
      (operation.base.sharedStatus
        ? operation.base.sharedStatus.revision !== remote.sharedStatus?.revision
        : remote.sharedStatus?.initialized)
    )
      result.conflicts.push({
        field: "assignedState revision",
        base: operation.base.sharedStatus?.revision ?? 0,
        local: patch.assignedState,
        remote: remote.sharedStatus?.revision,
      });
    if (result.conflicts.length) {
      await commit((data) => {
        recordDelivery(data, operation.opId, {
          status: "conflict",
          message: "Both browser and YouTrack changed these fields.",
          remote,
          conflicts: result.conflicts,
        });
      });
      throw Error("Review conflicting edits. Both versions were preserved.");
    }
  }
  const { assignedState, ...nativePatch } = patch;
  const metadata =
    cloudData(snapshot()).sharedStatuses && assignedState !== undefined
      ? sharedWrite(operation, remote, "assign", assignedState)
      : undefined;
  const finish = async (verified: TaskItem) => {
    await commit((data) => {
      const observed = observeStatus(data, verified);
      if (
        assignedState !== undefined &&
        observed.assignedState !== remote.assignedState &&
        observed.assignedState !== assignedState
      )
        throw Error("Assigned status changed during delivery.");
      acknowledge(
        data,
        operation,
        assignedState === undefined
          ? observed
          : assignStatus(data, verified, assignedState),
      );
    });
  };
  if (
    operation.type === "edit" &&
    !metadata &&
    !Object.keys(nativePatch).length
  ) {
    await finish(received);
    return;
  }
  await attemptDelivery(
    operation,
    commit,
    async () => {
      if (metadata) {
        if (!port.metadata)
          throw Error("Shared-status delivery is unavailable.");
        await port.metadata.write(operation.issueId, metadata);
      }
      if (operation.type === "edit" && Object.keys(nativePatch).length)
        await port.update(operation.issueId, nativePatch, remote);
      else if (operation.type === "comment") {
        const receipt = await port.comment(operation.issueId, operation.text);
        if (!receipt.id) throw Error("Missing comment receipt.");
        await commit((data) => {
          recordDelivery(data, operation.opId, { remoteId: receipt.id });
        });
      }
      const verified = await port.get(operation.issueId);
      if (!verified) throw Error("Readback unavailable.");
      if (
        operation.type === "edit" &&
        !Object.entries(nativePatch).every(([key, value]) => {
          return equal(verified[key as keyof TaskItem], value);
        })
      )
        throw Error("Readback differs.");
      confirmStatusAttempt(verified, metadata);
      await finish(verified);
    },
    operation.issueId,
    (data) => {
      saveStatusAttempt(data, operation, metadata);
    },
  );
};
