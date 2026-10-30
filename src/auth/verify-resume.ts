import type { YouTrackIdentity } from "./identity";
import { validResumeRecord, type ResumeRecord } from "./resume-record";
// No cached identity/project permissions may reveal a workspace after reload.
export const verifyResume = async (
  record: ResumeRecord,
  readIdentity: (token: string) => Promise<YouTrackIdentity>,
  assertCurrent: () => void,
  now: () => number = Date.now,
) => {
  const check = () => {
    assertCurrent();
    if (!validResumeRecord(record, now()))
      throw Error("Saved sign-in expired. Sign in again.");
  };
  check();
  const identity = await readIdentity(record.token);
  check();
  if (identity.id !== record.userId)
    throw Error("Saved sign-in belongs to a different account.");
  const project = record.projectId
    ? identity.projects.find((value) => {
        return value.id === record.projectId;
      })
    : null;
  if (record.projectId && !project)
    throw Error("The saved project is no longer available. Sign in again.");
  return { identity, project: project ?? null };
};
