import type { WorkspaceSnapshot } from "./types";
import { emptyWorkspace } from "./workspace-data";
export const initialSnapshot = (): WorkspaceSnapshot => {
  return {
    ready: false,
    updating: false,
    delivering: false,
    data: emptyWorkspace(),
    pendingWrites: 0,
    error: "",
    connection: "Not connected",
  };
};
