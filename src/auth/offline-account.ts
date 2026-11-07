import type { AuthorizedProject } from "./identity";
// The last signed-in account and PMON project, so saved work can open offline.
// Ids and names only: no token or session secret is ever written here.
const key = "romdex-offline-account-v1";
export interface OfflineAccount {
  userId: string;
  project: AuthorizedProject;
}
const text = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
};
export const rememberOfflineAccount = (
  userId: string,
  project: AuthorizedProject,
) => {
  if (project.shortName !== "PMON") return;
  const { id, shortName, name } = project;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ userId, project: { id, shortName, name } }),
    );
  } catch {
    /* Offline reopening is optional; a failed write only disables it. */
  }
};
export const forgetOfflineAccount = () => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Sign-out still rotates the cookie generation. */
  }
};
export const offlineAccount = (): OfflineAccount | null => {
  let value: unknown;
  try {
    value = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
  } catch {
    return null;
  }
  const record = value as Partial<OfflineAccount> | null;
  const project = record?.project;
  if (
    !record ||
    !text(record.userId) ||
    !project ||
    !text(project.id) ||
    project.shortName !== "PMON" ||
    !text(project.name)
  )
    return null;
  return {
    userId: record.userId,
    project: { id: project.id, shortName: "PMON", name: project.name },
  };
};
// fetch rejects with TypeError when the network is down; a timeout aborts.
export const isNetworkFailure = (error: unknown) => {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException &&
      ["TimeoutError", "NetworkError"].includes(error.name))
  );
};
