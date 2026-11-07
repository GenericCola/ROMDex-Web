import { flushDraftEditors } from "@/domain/editor-drafts";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { useEffect, useRef, useState } from "react";
type Update = (data: WorkspaceData) => void;
export const useInlineAction = () => {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<Update | null>(null);
  const run = (update: Update) => {
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
  // Keys pressed while the previous change is still saving (Escape right after Enter) wait for it
  // instead of being dropped; the input already showed them as handled.
  const queue = (update: Update) => {
    if (busy) pendingRef.current = update;
    else run(update);
  };
  const runPending = () => {
    const update = pendingRef.current;
    if (busy || !update) return;
    pendingRef.current = null;
    run(update);
  };
  useEffect(runPending);
  return { run, queue, error, busy };
};
