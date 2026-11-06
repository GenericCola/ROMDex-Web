import { refreshIncomingTask } from "@/cloud/incoming-refresh";
import type { TaskItem } from "@/domain/types";
import { useEffect, useRef, useState } from "react";
import { useDelayedFlag } from "./use-delayed-flag";
export const useFreshTask = (id: string) => {
  const [checking, setChecking] = useState(false),
    [error, setError] = useState("");
  const slow = useDelayedFlag(checking);
  const epochRef = useRef({ epoch: 0, busy: false });
  useEffect(() => {
    const lifetime = epochRef.current;
    return () => {
      lifetime.epoch++;
      lifetime.busy = false;
    };
  }, [id]);
  const open = (show: (item: TaskItem) => void) => {
    if (epochRef.current.busy) return;
    epochRef.current.busy = true;
    const { epoch } = epochRef.current;
    setChecking(true);
    setError("");
    void refreshIncomingTask(id)
      .then(
        (item) => {
          if (epoch === epochRef.current.epoch) show(item);
        },
        (failure: unknown) => {
          if (epoch === epochRef.current.epoch)
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not refresh this ticket. Your changes are retained.",
            );
        },
      )
      .finally(() => {
        if (epoch === epochRef.current.epoch) epochRef.current.busy = false;
        if (epoch === epochRef.current.epoch) setChecking(false);
      });
  };
  return { checking, slow, error, open };
};
