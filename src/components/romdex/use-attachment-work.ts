import { registerDraftEditor } from "@/domain/editor-drafts";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { useLayoutEffect, useRef, useState } from "react";
export const useAttachmentWork = () => {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    pendingRef = useRef<Promise<void> | null>(null);
  const execute = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Attachment operation failed. Keep the original file.",
      );
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const runAwaitable = (action: () => Promise<void>) => {
    if (pendingRef.current) return;
    const pending = trackWorkspaceWork(() => {
      return execute(action);
    });
    pendingRef.current = pending;
    void pending
      .finally(() => {
        if (pendingRef.current === pending) pendingRef.current = null;
      })
      .catch(() => {
        return undefined;
      });
    return pending;
  };
  useLayoutEffect(() => {
    return registerDraftEditor({
      label: "Attachment operation in progress",
      dirty: () => {
        return pendingRef.current !== null;
      },
      flush: async () => {
        await pendingRef.current;
      },
    });
  }, [busy]);
  const run = (action: () => Promise<void>) => {
    void runAwaitable(action);
  };
  return { busy, message, setMessage, run, runAwaitable };
};
