import { workspaceStore } from "@/domain/workspace-store";
import { reconcileDeletionRecords } from "./delivery-preflight";
import { cloudData, type DeliveryPort } from "./types";
export const resumeDeletionReadback = async (
  port: DeliveryPort,
  current: () => void,
) => {
  const { data } = workspaceStore.getSnapshot();
  if (
    !data.operations.some((op) => {
      return op.type === "delete" && cloudData(data).records[op.opId];
    })
  )
    return;
  await workspaceStore.deliver((commit) => {
    return reconcileDeletionRecords(
      () => {
        return workspaceStore.getSnapshot().data;
      },
      commit,
      port,
    );
  });
  current();
};
