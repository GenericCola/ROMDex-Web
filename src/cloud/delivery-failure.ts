import { workspaceStore } from "@/domain/workspace-store";
import { globalDeliveryFailure } from "./global-delivery-failure";
export const reportDeliveryFailure = (error: unknown, automatic = false) => {
  workspaceStore.setConnection(
    (automatic ? "Automatic delivery paused: " : "Save stopped: ") +
      (globalDeliveryFailure(error)
        ? "Sign in with YouTrack again. Any uncertain change and its evidence are preserved; nothing will be resent automatically."
        : error instanceof Error
          ? error.message
          : "Check the pending change."),
  );
};
