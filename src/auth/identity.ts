import { list, sessionRequest } from "@/youtrack/request";
import { ResumeRejected } from "./resume-failure";
export interface AuthorizedProject {
  id: string;
  shortName: string;
  name: string;
}
export interface YouTrackIdentity {
  id: string;
  name: string;
  projects: AuthorizedProject[];
}
export const readIdentity = async (
  token: string,
): Promise<YouTrackIdentity> => {
  const request = sessionRequest(token);
  const raw = await request("users/me?fields=id,login,fullName,guest");
  if (!raw || typeof raw !== "object")
    throw Error("Could not verify your YouTrack identity.");
  const user = raw as Record<string, unknown>;
  if (
    typeof user.id !== "string" ||
    !user.id ||
    typeof user.login !== "string" ||
    !user.login ||
    user.guest === true ||
    user.login === "guest"
  )
    throw new ResumeRejected("A signed-in YouTrack account is required.");
  const projects = await list<AuthorizedProject>(
    request,
    "admin/projects",
    "id,shortName,name",
  );
  const ids = new Set<string>();
  for (const project of projects) {
    if (
      !project ||
      typeof project.id !== "string" ||
      !project.id ||
      typeof project.name !== "string" ||
      typeof project.shortName !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(project.shortName) ||
      ids.has(project.id)
    )
      throw Error("YouTrack returned an invalid project list.");
    ids.add(project.id);
  }
  return {
    id: user.id,
    name:
      typeof user.fullName === "string"
        ? user.fullName
        : typeof user.login === "string"
          ? user.login
          : user.id,
    projects,
  };
};
export interface ProjectIssue {
  id: string;
  idReadable: string;
  summary: string;
  description: string | null;
  project: { id: string; shortName: string };
}
export const readProject = async (
  token: string,
  project: AuthorizedProject,
) => {
  const items = await list<ProjectIssue>(
    sessionRequest(token),
    "issues",
    "id,idReadable,summary,description,project(id,shortName)",
    "project: {" + project.shortName + "} sort by: created asc",
  );
  for (const item of items) {
    if (
      !item ||
      item.project?.id !== project.id ||
      item.project.shortName !== project.shortName ||
      typeof item.summary !== "string" ||
      typeof item.id !== "string" ||
      typeof item.idReadable !== "string" ||
      !item.idReadable.startsWith(project.shortName + "-") ||
      !(item.description === null || typeof item.description === "string")
    )
      throw Error("YouTrack returned a task outside the selected project.");
  }
  return items;
};
