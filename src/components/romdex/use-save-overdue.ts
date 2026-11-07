import type { WorkspaceSnapshot } from "@/domain/types";
import { useEffect, useRef, useState } from "react";
import { nextOverdueAt, pendingSaveKeys, saveOverdue } from "./save-age";
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
    // One timer for the moment the oldest unsaved change becomes overdue.
    const due = nextOverdueAt(agesRef.current, Date.now());
    if (due === null) return undefined;
    const timer = setTimeout(update, due - Date.now());
    return () => {
      return clearTimeout(timer);
    };
  }, [state, drafts]);
  return overdue;
};
