import { flushDraftEditors } from "@/domain/editor-drafts";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { useState } from "react";
export const useInlineAction = () => {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (update: (data: WorkspaceData) => void) => {
    if (busy) return;
    setBusy(true);
    setError("");
    void trackWorkspaceWork(async () => {
      await flushDraftEditors();
      await workspaceStore.change(update);
      await workspaceStore.flush();
    })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "The row could not be saved.",
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { run, error, busy };
};
