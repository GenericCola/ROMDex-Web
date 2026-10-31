import { cloudData } from "@/cloud/types";
import type { LampColor, WorkspaceSnapshot } from "@/domain/types";
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
        ? "Automatic delivery is paused after an earlier failure. Open Connection Details using the connection light beside Save Changes, resolve the listed changes, then use Save Changes to explicitly retry; turning this switch on does not resend them."
        : connected
          ? "When enabled and not paused, sends committed changes after a short typing pause. Turning Off lets the current operation finish, then stops automatic delivery."
          : "Delivery is disconnected. Open Connection Details to retry the data connection. No changes are sent by opening it.",
  };
};
export const saveExplanation = (state: WorkspaceSnapshot, drafts: boolean) => {
  if (state.error) return `Local save needs attention: ${state.error}`;
  if (state.delivering)
    return "Save current drafts in this browser while background delivery continues. Additional changes stay queued.";
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
  if (
    Object.values(cloudData(state.data).records ?? {}).some((record) => {
      return ["conflict", "uncertain", "attempting"].includes(record.status);
    })
  )
    reasons.push("A saved change needs review");
  return reasons.length
    ? `${reasons.join("; ")}.`
    : "No pending changes in this browser.";
};

export const deliveryMessage = (
  state: WorkspaceSnapshot,
  message: { text: string; connection: string } | null,
) => {
  if (message?.connection === state.connection) return message.text;
  if (state.delivering)
    return "Background delivery is running. You can save additional work in this browser.";
  return /^(Automatic delivery paused|Save stopped):/.test(state.connection)
    ? state.connection
    : "";
};

export const saveIndicator = (state: WorkspaceSnapshot, drafts: boolean) => {
  const pending =
    drafts ||
    state.data.operations.length > 0 ||
    !!cloudData(state.data).rollupPending ||
    Object.values(cloudData(state.data).records ?? {}).some((record) => {
      return ["conflict", "uncertain", "attempting"].includes(record.status);
    });
  const color: LampColor = state.error
    ? "red"
    : state.pendingWrites
      ? "yellow"
      : pending
        ? "red"
        : "green";
  return { color, description: saveExplanation(state, drafts) };
};
