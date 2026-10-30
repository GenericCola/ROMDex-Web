import { trackWorkspaceWork } from "@/domain/workspace-work";
import { useRef, useState } from "react";
// Do not register this work as a draft: it flushes other editors before acting.
export const useSelectionWork = () => {
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const run = (action: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setMessage("");
    void trackWorkspaceWork(action)
      .catch((reason: unknown) => {
        setMessage(
          reason instanceof Error
            ? reason.message
            : "Selection could not be changed.",
        );
      })
      .finally(() => {
        pendingRef.current = false;
        setBusy(false);
      });
  };
  return { busy, message, run };
};
