import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
const downloadRecovery = async () => {
  try {
    await flushDraftEditors();
    await workspaceStore.flush();
  } catch {
    workspaceStore.setConnection(
      "Recovery exported from memory; local saving still needs attention.",
    );
  }
  const blob = new Blob([workspaceStore.recover()], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    "ROMDex-Web-Recovery-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
export const exportRecovery = () => {
  void downloadRecovery().catch((error: unknown) => {
    workspaceStore.setConnection(
      error instanceof Error ? error.message : "Recovery export failed.",
    );
  });
};
