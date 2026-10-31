import type { TaskItem, WorkspaceData } from "@/domain/types";
import { planReceipt } from "@/rdx/plan-ledger";
import { acknowledge, recordDelivery } from "./journal";
import { cloudData } from "./types";
export const rebaseEdit = (
  data: WorkspaceData,
  opId: string,
  remote: TaskItem,
) => {
  const at = data.operations.findIndex((op) => {
    return op.opId === opId;
  });
  const operation = data.operations[at];
  if (operation?.type !== "edit") throw Error("Only an edit can be rebased.");
  let readyId = opId;
  if (operation.patch.tags !== undefined && cloudData(data).records[opId]) {
    const replacement = {
      ...operation,
      opId: crypto.randomUUID(),
      base: remote,
    };
    data.operations.splice(at, 1, replacement);
    readyId = replacement.opId;
    recordDelivery(data, opId, {
      status: "confirmed",
      archivedOperation: structuredClone(operation),
      message:
        "Prior tag attempt archived after explicit fresh readback/rebase; its historical request outcome is not inferred.",
    });
    planReceipt(data, opId, {}, replacement.opId);
  } else if (cloudData(data).sharedStatuses) {
    acknowledge(data, operation);
    recordDelivery(data, opId, {
      message: "Previous edit archived after explicit shared-status rebase.",
    });
    readyId = crypto.randomUUID();
    data.operations.splice(at, 0, {
      ...operation,
      opId: readyId,
      base: remote,
    });
  } else {
    operation.base = remote;
    const cloud = cloudData(data);
    delete cloud.records[opId];
    data.cloud = cloud;
  }
  recordDelivery(data, readyId, {
    status: "ready",
    message:
      "Your reviewed choice is saved in this browser. Save Changes sends it after a fresh check.",
  });
};
