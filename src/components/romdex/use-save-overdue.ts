import type { WorkspaceSnapshot } from "@/domain/types";
import { useEffect, useRef, useState } from "react";
import { pendingSaveKeys, saveOverdue } from "./save-age";
export const useSaveOverdue = (state: WorkspaceSnapshot, drafts: boolean) => {
  const agesRef = useRef(new Map<string, number>());
  const [overdue, setOverdue] = useState(false);
  useEffect(() => {
    const update = () => {
      return setOverdue(
        saveOverdue(
          agesRef.current,
          pendingSaveKeys(state, drafts),
          Date.now(),
        ),
      );
    };
    update();
    const timer = setInterval(update, 15_000);
    return () => {
      return clearInterval(timer);
    };
  }, [state, drafts]);
  return overdue;
};
