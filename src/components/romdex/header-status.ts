import { cloudData } from "@/cloud/types";
import type { WorkspaceSnapshot } from "@/domain/types";
export const syncControl = (
  connected: boolean,
  enabled: boolean,
  paused = false,
) => {
  return {
    connected,
    value: connected
      ? enabled
        ? paused
          ? "Paused"
          : "On"
        : "Off"
      : enabled
        ? "Paused"
        : "Off",
    role: connected ? ("switch" as const) : ("button" as const),
    checked: connected ? enabled : undefined,
    label: connected
      ? "Auto-Sync Data"
      : "Auto-Sync Data. Delivery disconnected. Open Connection Details",
    description:
      connected && paused
        ? "Automatic delivery is paused after an earlier failure. Review the pending changes, then use Save Changes to explicitly retry; turning this switch on does not resend them."
        : connected
          ? "When enabled and not paused, checks supported queued changes every 10 seconds while connected"
          : "Delivery is disconnected. Open Connection Details to retry the data connection. No changes are sent by opening it.",
  };
};
export const saveExplanation = (state: WorkspaceSnapshot, drafts: boolean) => {
  if (state.error) return `Local save needs attention: ${state.error}`;
  if (state.pendingWrites) return "Saving changes in this browser.";
  const reasons: string[] = [];
  if (drafts) reasons.push("Unsaved editor drafts");
  const count = state.data.operations.length;
  if (count)
    reasons.push(
      `${count} queued change${count === 1 ? "" : "s"} not yet confirmed in YouTrack`,
    );
  if (cloudData(state.data).rollupPending)
    reasons.push("Parent status calculation pending");
  return reasons.length
    ? `${reasons.join("; ")}.`
    : "No pending changes in this browser.";
};

export const deliveryMessage = (
  state: WorkspaceSnapshot,
  message: { text: string; connection: string } | null,
) => {
  if (state.delivering) return "";
  if (message?.connection === state.connection) return message.text;
  return state.connection.startsWith("Automatic delivery paused")
    ? state.connection
    : "";
};
