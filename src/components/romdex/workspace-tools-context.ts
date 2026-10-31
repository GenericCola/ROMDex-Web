import { createContext } from "react";
export type WorkspaceTool = "export" | "import" | "updates";
export const WorkspaceToolsContext = createContext<
  ((tool: WorkspaceTool) => void) | null
>(null);
