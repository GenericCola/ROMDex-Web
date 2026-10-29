import { trackWorkspaceWork } from "@/domain/workspace-work";
import { useRef, useState } from "react";
export const useRdxOperation = () => {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    generationRef = useRef(0);
  const run = async (task: () => Promise<void>) => {
    const generation = ++generationRef.current;
    setBusy(true);
    setMessage("");
    try {
      await trackWorkspaceWork(task);
    } catch (error) {
      if (generation === generationRef.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "RDX operation failed. Keep the source file.",
        );
    } finally {
      if (generation === generationRef.current) setBusy(false);
    }
  };
  return { busy, message, setMessage, run };
};
