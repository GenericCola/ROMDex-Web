import type { UploadStore } from "@/attachments/types";
import type { WorkspaceData } from "@/domain/types";
import { seedAssigned } from "./assigned-status";
import { deliverAttachment } from "./attachment-delivery";
import { cancelLocalDeletions } from "./cancel-local-deletions";
import { deliverCreation } from "./creation";
import { creationDependency } from "./creation-dependency";
import { deliverDeletion } from "./deletion";
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
    seedAssigned(data);
    data.cloud = { ...cloudData(data), accountId: port.accountId };
  });
  await refreshShared(snapshot, commit, port);
  while (snapshot().operations.length || cloudData(snapshot()).rollupPending) {
    const planned = !snapshot().operations.length
      ? await planRollup(snapshot, commit, port)
      : undefined;
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
      await deliverDeletion(operation, snapshot, commit, port);
      continue;
    }
    if (operation.type === "edit" && operation.purpose === "rollup")
      await deliverRollup(operation, snapshot, commit, port, planned);
    else await deliverExisting(operation, snapshot, commit, port);
  }
};
