import { createContext } from "react";
export type WorkspaceTool = "export" | "import" | "updates" | "install";
export const WorkspaceToolsContext = createContext<
  ((tool: WorkspaceTool) => void) | null
>(null);
