import { adoptTasks } from "@/cloud/assigned-status";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { scopedWorkspaceKey } from "@/storage/workspace-key";
import { WorkspaceStorage } from "@/storage/workspace-storage";
import { readTasks, YOUTRACK_ORIGIN } from "@/youtrack/read-tasks";
import type { AuthorizedProject } from "./identity";
import { readIdentity, readProject } from "./identity";
import { ResumeRejected } from "./resume-failure";
export const openPmonWorkspace = async (
  token: string,
  userId: string,
  projectId: string,
  isCurrent: () => boolean,
) => {
  const key = scopedWorkspaceKey(YOUTRACK_ORIGIN, userId, projectId);
  await workspaceStore.switchPersistence(new WorkspaceStorage(key));
  uploadStorage.setScope(key);
  const opened = workspaceStore.getSnapshot();
  if (!opened.ready || opened.error)
    throw Error(opened.error || "Workspace could not open.");
  if (!isCurrent()) return;
  if (!opened.data.remote.length && !opened.data.operations.length) {
    const assertCurrent = () => {
      if (!isCurrent()) throw Error("The sign-in session changed.");
    };
    const tasks = await readTasks(token, assertCurrent);
    if (!isCurrent()) return;
    await workspaceStore.change((data) => {
      adoptTasks(data, tasks);
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
