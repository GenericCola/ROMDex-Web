import { workspaceStore } from "@/domain/workspace-store";
export const reportDeliveryFailure = (error: unknown, automatic = false) => {
  workspaceStore.setConnection(
    (automatic ? "Automatic delivery paused: " : "Save stopped: ") +
      (error instanceof Error ? error.message : "Check the pending change."),
  );
};
