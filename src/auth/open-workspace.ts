import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { scopedWorkspaceKey } from "@/storage/workspace-key";
import { WorkspaceStorage } from "@/storage/workspace-storage";
import { readTasks, YOUTRACK_ORIGIN } from "@/youtrack/read-tasks";
import type { AuthorizedProject } from "./identity";
import { readIdentity, readProject } from "./identity";
import { initializeWorkspaceTasks } from "./initialize-workspace";
import { ResumeRejected } from "./resume-failure";
// Opens this account's browser workspace; resolves null if the run went stale.
const switchWorkspace = async (
  userId: string,
  projectId: string,
  isCurrent: () => boolean,
) => {
  const key = scopedWorkspaceKey(YOUTRACK_ORIGIN, userId, projectId);
  const storage = new WorkspaceStorage(key);
  const isNew = !(await storage.load());
  if (!isCurrent()) return null;
  await workspaceStore.switchPersistence(storage);
  uploadStorage.setScope(key);
  const opened = workspaceStore.getSnapshot();
  if (!opened.ready || opened.error)
    throw Error(opened.error || "Workspace could not open.");
  return isCurrent() ? { isNew, data: opened.data } : null;
};
const hasSavedWork = (data: { remote: unknown[]; operations: unknown[] }) => {
  return data.remote.length > 0 || data.operations.length > 0;
};
// Offline: open only work already saved in this browser; nothing is read or sent.
export const openOfflineWorkspace = async (
  userId: string,
  projectId: string,
  isCurrent: () => boolean,
) => {
  const opened = await switchWorkspace(userId, projectId, isCurrent);
  if (opened && !hasSavedWork(opened.data))
    throw Error("No saved work in this browser yet. Connect to open ROMDex.");
  return opened !== null;
};
export const openPmonWorkspace = async (
  token: string,
  userId: string,
  projectId: string,
  isCurrent: () => boolean,
) => {
  const opened = await switchWorkspace(userId, projectId, isCurrent);
  if (!opened) return;
  const { isNew } = opened;
  if (!hasSavedWork(opened.data)) {
    const assertCurrent = () => {
      if (!isCurrent()) throw Error("The sign-in session changed.");
    };
    const tasks = await readTasks(token, assertCurrent);
    if (!isCurrent()) return;
    await workspaceStore.change((data) => {
      initializeWorkspaceTasks(data, tasks, isNew);
    });
    await workspaceStore.flush();
  }
};

export const prepareProject = async (
  token: string,
  userId: string,
  project: AuthorizedProject,
  isCurrent: () => boolean,
) => {
  const fresh = await readIdentity(token);
  if (
    fresh.id !== userId ||
    !fresh.projects.some((item) => {
      return item.id === project.id && item.shortName === project.shortName;
    })
  )
    throw new ResumeRejected(
      "This project is no longer available to your account.",
    );
  if (!isCurrent()) throw Error("The sign-in session changed.");
  const items = await readProject(token, project);
  if (!isCurrent()) throw Error("The sign-in session changed.");
  if (project.shortName === "PMON")
    await openPmonWorkspace(token, userId, project.id, isCurrent);
  return items;
};
