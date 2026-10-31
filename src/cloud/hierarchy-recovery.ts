import { readIdentity } from "@/auth/identity";
import { leaveRecoveryMode, recoveryMode } from "@/auth/recovery-mode";
import { authIdentity, authRequestGuard, authToken } from "@/auth/session";
import {
  previewHierarchyRecovery,
  type HierarchyPreview,
} from "@/domain/hierarchy-recovery";
import { workspaceStore } from "@/domain/workspace-store";
import { readTasks } from "@/youtrack/read-tasks";
import { disconnectDelivery } from "./session";
const idle = () => {
  const state = workspaceStore.getSnapshot();
  if (
    !recoveryMode() ||
    !state.ready ||
    state.error ||
    state.pendingWrites ||
    state.delivering ||
    state.updating
  )
    throw Error(
      "Open recovery mode and wait for local saving to finish. Nothing was sent.",
    );
  return state.data;
};
export const readHierarchyRecovery = async () => {
  idle();
  disconnectDelivery();
  const token = authToken(),
    scope = authIdentity(),
    guard = authRequestGuard(token);
  const identity = await readIdentity(token);
  guard();
  if (
    identity.id !== "2-2" ||
    identity.id !== scope.userId ||
    !identity.projects.some((p) => {
      return p.id === scope.projectId && p.shortName === "PMON";
    })
  )
    throw Error(
      "This incident recovery is limited to the affected PMON account.",
    );
  const baseline = JSON.stringify(idle());
  const tasks = await readTasks(token, guard);
  guard();
  const data = idle();
  if (JSON.stringify(data) !== baseline)
    throw Error("Workspace changed while reading. Preview again.");
  return previewHierarchyRecovery(data, tasks, scope);
};
export const repairHierarchyRecovery = async (
  preview: HierarchyPreview,
  selected: string[],
) => {
  if (JSON.stringify(idle()) !== preview.baseline)
    throw Error("Workspace changed. Preview again before repairing.");
  const fresh = await readHierarchyRecovery();
  if (JSON.stringify(fresh) !== JSON.stringify(preview))
    throw Error(
      "Server hierarchy or workspace changed. Preview again before repairing.",
    );
  await workspaceStore.repairHierarchy(preview, selected, authIdentity());
  await workspaceStore.flush();
};
export const exitHierarchyRecovery = async () => {
  const fresh = await readHierarchyRecovery();
  idle();
  await workspaceStore.repairHierarchy(fresh, null, authIdentity());
  await workspaceStore.flush();
  leaveRecoveryMode();
};
