import { recoveryMode } from "@/auth/recovery-mode";
import {
  applyHierarchyRecovery,
  exitHierarchyRecovery,
  type HierarchyPreview,
} from "./hierarchy-recovery";
import type { RecoveryScope } from "./order-recovery";
import type { WorkspaceData, WorkspaceSnapshot } from "./types";
export const persistHierarchyRecovery = (
  state: WorkspaceSnapshot,
  switching: boolean,
  write: (update: (data: WorkspaceData) => void) => Promise<void>,
  preview: HierarchyPreview,
  selected: string[] | null,
  scope: RecoveryScope,
) => {
  if (
    !recoveryMode() ||
    switching ||
    !state.ready ||
    state.error ||
    state.pendingWrites ||
    state.delivering ||
    state.updating
  )
    throw Error(
      "Recovery requires an idle, disconnected workspace with local saving available.",
    );
  // Narrow exception to review locks: only validated parent repair or explicit safe exit.
  return write((data) => {
    if (selected === null) exitHierarchyRecovery(data, preview, scope);
    else applyHierarchyRecovery(data, preview, selected, scope);
  });
};
