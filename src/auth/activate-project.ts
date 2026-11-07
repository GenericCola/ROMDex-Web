import { disconnectDelivery } from "@/cloud/session";
import { connectProject } from "./connect-project";
import { flushLocal } from "./flush-local";
import type { AuthorizedProject } from "./identity";
import { rememberOfflineAccount } from "./offline-account";
import { prepareProject } from "./open-workspace";
import { setAuthSession } from "./session";
import { rememberSession } from "./tab-session";
export const activateProject = async (
  auth: { token: string; expiresAt: number },
  userId: string,
  project: AuthorizedProject,
  isCurrent: () => boolean,
) => {
  const check = () => {
    if (!isCurrent()) throw Error("The sign-in session changed.");
  };
  check();
  const items = await prepareProject(auth.token, userId, project, isCurrent);
  const warning = await connectOpenedProject(auth, userId, project, check);
  return { items, warning };
};
// Connects the already open workspace, e.g. after an offline start comes back online.
export const connectOpenedProject = async (
  auth: { token: string; expiresAt: number },
  userId: string,
  project: AuthorizedProject,
  check: () => void,
) => {
  check();
  rememberSession(auth, userId, project.id);
  rememberOfflineAccount(userId, project);
  setAuthSession({ ...auth, userId, projectId: project.id });
  const warning = await connectProject(auth.token, project, check);
  check();
  return warning;
};

export const closeProjectConnection = async () => {
  await flushLocal();
  disconnectDelivery();
  setAuthSession(null);
};
