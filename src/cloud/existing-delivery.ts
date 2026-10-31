import { reconcile } from "@/domain/accepted/core.mjs";
import type { TaskItem, TaskOperation, WorkspaceData } from "@/domain/types";
import { assignmentPatch, observeStatus } from "./assigned-status";
import { equal, supported } from "./delivery-helpers";
import { nativeTagBaseline, prepareEditPatch } from "./edit-patch-delivery";
import { finishExisting } from "./finish-existing";
import { attemptDelivery, recordDelivery } from "./journal";
import { OperationReviewRequired } from "./review-isolation";
import {
  confirmStatusAttempt,
  saveStatusAttempt,
  sharedWrite,
} from "./shared-status-delivery";
import { tagReconcileValues } from "./tag-reconcile";
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
  if (!received) {
    const message =
      operation.issueId +
      " is no longer readable. Its change is preserved; nothing was sent for it.";
    await commit((data) => {
      recordDelivery(data, operation.opId, { status: "conflict", message });
    });
    throw new OperationReviewRequired(message);
  }
  const receivedBaseline = await nativeTagBaseline(operation, received, port);
  let remote = receivedBaseline;
  await commit((data) => {
    remote = observeStatus(data, receivedBaseline);
  });
  let patch = operation.type === "edit" ? assignmentPatch(operation.patch) : {};
  if (operation.type === "edit") {
    const base = {
      ...operation.base,
      assignedState: operation.base.assignedState ?? operation.base.state,
    };
    const normalized = tagReconcileValues(base, patch, remote);
    const result = reconcile(
      normalized.base,
      normalized.patch,
      normalized.remote,
    );
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
      throw new OperationReviewRequired(
        "Review conflicting edits. Both versions were preserved.",
      );
    }
  }
  const { assignedState, ...nativePatch } = patch;
  const metadata =
    cloudData(snapshot()).sharedStatuses && assignedState !== undefined
      ? sharedWrite(operation, remote, "assign", assignedState)
      : undefined;
  const finish = (verified: TaskItem) => {
    return finishExisting(operation, remote, assignedState, verified, commit);
  };
  if (
    operation.type === "edit" &&
    !metadata &&
    !Object.keys(nativePatch).length
  ) {
    await finish(remote);
    return;
  }
  const deliverPatch =
    operation.type === "edit"
      ? await prepareEditPatch(
          operation,
          nativePatch,
          remote,
          snapshot,
          commit,
          port,
        )
      : null;
  await attemptDelivery(
    operation,
    commit,
    async () => {
      if (metadata) {
        if (!port.metadata)
          throw Error("Shared-status delivery is unavailable.");
        await port.metadata.write(operation.issueId, metadata);
      }
      if (deliverPatch) await deliverPatch();
      else if (operation.type === "comment") {
        const receipt = await port.comment(operation.issueId, operation.text);
        if (!receipt.id) throw Error("Missing comment receipt.");
        await commit((data) => {
          recordDelivery(data, operation.opId, { remoteId: receipt.id });
        });
      }
      const readback = await port.get(operation.issueId);
      if (!readback) throw Error("Readback unavailable.");
      const verified = await nativeTagBaseline(operation, readback, port);
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
