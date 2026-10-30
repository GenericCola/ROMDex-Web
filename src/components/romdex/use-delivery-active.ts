import { workspaceStore } from "@/domain/workspace-store";
import { useSyncExternalStore } from "react";
const deliveryActive = () => {
  return workspaceStore.getSnapshot().delivering;
};
export const useDeliveryActive = () => {
  return useSyncExternalStore(
    workspaceStore.subscribe,
    deliveryActive,
    deliveryActive,
  );
};
