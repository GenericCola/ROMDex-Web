import { recoveryWithUploads } from "@/attachments/recovery";
import { authIdentity, hasAuthSession } from "@/auth/session";
import { workspaceStore } from "@/domain/workspace-store";
export const downloadRecoveryText = (text: string, filename: string) => {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
export const captureRecovery = async () => {
  // Capture first: exporting must never flush editors, save the workspace, or
  // wake queued delivery. recover() already captures dirty editor buffers.
  const root = JSON.parse(workspaceStore.recover()) as Record<string, unknown>;
  if (hasAuthSession()) root.recoveryScope = authIdentity();
  return recoveryWithUploads(JSON.stringify(root));
};
const downloadRecovery = async () => {
  downloadRecoveryText(
    await captureRecovery(),
    "ROMDex-Web-Recovery-" + new Date().toISOString().slice(0, 10) + ".json",
  );
};
export const exportRecovery = () => {
  void downloadRecovery().catch((error: unknown) => {
    window.alert(
      error instanceof Error ? error.message : "Recovery export failed.",
    );
  });
};
