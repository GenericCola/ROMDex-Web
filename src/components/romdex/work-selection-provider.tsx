import {
  reconcileSelection,
  remapSelection,
  toggleSelection,
  type SelectionModifiers,
  type WorkSelection,
} from "@/domain/work-selection";
import { useRef, useState, type PropsWithChildren } from "react";
import { WorkSelectionContext } from "./work-selection-context";
export const WorkSelectionProvider = ({ children }: PropsWithChildren) => {
  const groupRef = useRef<(() => void) | null>(null);
  const registerGroup = (action: () => void) => {
    groupRef.current = action;
    return () => {
      if (groupRef.current === action) groupRef.current = null;
    };
  };
  const group = () => {
    if (!groupRef.current) return false;
    groupRef.current();
    return true;
  };
  const [selection, setSelection] = useState<WorkSelection>({
    ids: [],
    anchor: null,
  });
  const reconcile = (
    visible: string[],
    mapping: Record<string, string> = {},
  ) => {
    setSelection((prior) => {
      const next = reconcileSelection(remapSelection(prior, mapping), visible);
      return JSON.stringify(next) === JSON.stringify(prior) ? prior : next;
    });
  };
  const toggle = (
    id: string,
    visible: string[],
    modifiers: SelectionModifiers,
  ) => {
    setSelection((prior) => {
      return toggleSelection(prior, id, visible, modifiers);
    });
  };
  const clear = () => {
    setSelection({ ids: [], anchor: null });
  };
  return (
    <WorkSelectionContext
      value={{ selection, reconcile, toggle, clear, registerGroup, group }}
    >
      {children}
    </WorkSelectionContext>
  );
};
