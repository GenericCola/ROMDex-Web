import { workspaceStore } from "@/domain/workspace-store";
import { reconcileDeletionRecords } from "./delivery-preflight";
import { reconcileUploads, uploadReadbackDue } from "./reconcile-uploads";
import { cloudData, type DeliveryPort } from "./types";
export const resumeUploadReadback = async (port: DeliveryPort) => {
  const snapshot = () => {
    return workspaceStore.getSnapshot().data;
  };
  if (uploadReadbackDue(snapshot(), port))
    await workspaceStore.deliver((commit) => {
      return reconcileUploads(snapshot, commit, port);
    });
};
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
