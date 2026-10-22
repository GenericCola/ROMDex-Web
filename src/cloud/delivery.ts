import { reconcile } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { cancelLocalDeletions } from "./cancel-local-deletions";
import { deliverCreation } from "./creation";
import { creationDependency } from "./creation-dependency";
import { deliverDeletion } from "./deletion";
import { equal, supported } from "./delivery-helpers";
import { acknowledge, attemptDelivery, recordDelivery } from "./journal";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
import { validateQueue } from "./validation";
export const deliverQueue = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  validateQueue(snapshot());
  const blocked = Object.values(cloudData(snapshot()).records).find(
    (record) => {
      return ["attempting", "uncertain", "conflict"].includes(record.status);
    },
  );
  if (blocked)
    throw Error(
      blocked.status === "conflict"
        ? "Review the conflicting operation before continuing."
        : "An earlier request has an uncertain result. Review it before sending more changes.",
    );
  const binding = cloudData(snapshot()).accountId;
  if (binding && binding !== port.accountId)
    throw Error("This browser queue belongs to a different YouTrack account.");
  await commit((data) => {
    cancelLocalDeletions(data);
    data.cloud = { ...cloudData(data), accountId: port.accountId };
  });
  while (snapshot().operations.length) {
    const first = snapshot().operations[0];
    if (!first) return;
    const dependency = creationDependency(snapshot());
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
    if (operation.type === "create") {
      await deliverCreation(operation, commit, port);
      continue;
    }
    if (operation.type === "delete") {
      await deliverDeletion(operation, snapshot, commit, port);
      continue;
    }
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
    const remote = {
      ...received,
      assignedState: received.assignedState ?? received.state,
    };
    let patch = operation.type === "edit" ? operation.patch : {};
    if (operation.type === "edit") {
      const base = {
        ...operation.base,
        assignedState: operation.base.assignedState ?? operation.base.state,
      };
      const result = reconcile(base, operation.patch, remote);
      ({ patch } = result);
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
      if (!Object.keys(patch).length) {
        await commit((data) => {
          acknowledge(data, operation, remote);
        });
        continue;
      }
    }
    await attemptDelivery(operation, commit, async () => {
      if (operation.type === "edit")
        await port.update(operation.issueId, patch, remote);
      else {
        const receipt = await port.comment(operation.issueId, operation.text);
        if (!receipt.id) throw Error("Missing comment receipt.");
        await commit((data) => {
          recordDelivery(data, operation.opId, { remoteId: receipt.id });
        });
      }
      const result = await port.get(operation.issueId);
      if (!result) throw Error("Readback unavailable.");
      const verified = {
        ...result,
        assignedState: result.assignedState ?? result.state,
      };
      if (
        operation.type === "edit" &&
        !Object.entries(patch).every(([key, value]) => {
          return equal(verified[key as keyof TaskItem], value);
        })
      )
        throw Error("Readback differs.");
      await commit((data) => {
        acknowledge(data, operation, verified);
      });
    });
  }
};
