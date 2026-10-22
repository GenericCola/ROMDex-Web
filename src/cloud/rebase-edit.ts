import type { TaskItem, WorkspaceData } from "@/domain/types";
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
  if (cloudData(data).sharedStatuses) {
    acknowledge(data, operation);
    recordDelivery(data, opId, {
      message: "Previous edit archived after explicit shared-status rebase.",
    });
    data.operations.splice(at, 0, {
      ...operation,
      opId: crypto.randomUUID(),
      base: remote,
    });
  } else {
    operation.base = remote;
    const cloud = cloudData(data);
    delete cloud.records[opId];
    data.cloud = cloud;
  }
};
