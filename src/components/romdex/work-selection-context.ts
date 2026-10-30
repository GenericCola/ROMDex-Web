import type {
  SelectionModifiers,
  WorkSelection,
} from "@/domain/work-selection";
import { createContext, use } from "react";
interface SelectionContext {
  selection: WorkSelection;
  reconcile: (visible: string[], mapping?: Record<string, string>) => void;
  toggle: (
    id: string,
    visible: string[],
    modifiers: SelectionModifiers,
  ) => void;
  clear: () => void;
}
export const WorkSelectionContext = createContext<SelectionContext | null>(
  null,
);
export const useWorkSelection = () => {
  const context = use(WorkSelectionContext);
  if (!context) throw Error("Work selection requires its workspace provider.");
  return context;
};
