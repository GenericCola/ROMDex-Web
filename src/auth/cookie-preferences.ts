import type { YouTrackIdentity } from "./identity";
const key = "romdex-cookie-project-v1:";
export const savedCookieProject = (userId: string) => {
  try {
    return localStorage.getItem(key + encodeURIComponent(userId));
  } catch {
    return null;
  }
};
export const saveCookieProject = (userId: string, projectId: string | null) => {
  try {
    if (projectId)
      localStorage.setItem(key + encodeURIComponent(userId), projectId);
    else localStorage.removeItem(key + encodeURIComponent(userId));
  } catch {
    /* Permission checks remain authoritative if preference storage fails. */
  }
};
export const cookieResumeWanted = (value?: boolean) => {
  try {
    if (value !== undefined)
      localStorage.setItem("romdex-cookie-resume-v1", String(value));
    return localStorage.getItem("romdex-cookie-resume-v1") === "true";
  } catch {
    return false;
  }
};

export const preferredCookieProject = (identity: YouTrackIdentity) => {
  const saved = savedCookieProject(identity.id);
  return (
    identity.projects.find((project) => {
      return project.id === saved;
    }) ??
    identity.projects.find((project) => {
      return project.shortName === "PMON";
    }) ??
    (identity.projects.length === 1 ? identity.projects[0] : undefined)
  );
};
