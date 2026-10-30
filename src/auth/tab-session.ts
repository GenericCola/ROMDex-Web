import { YOUTRACK_ORIGIN } from "@/youtrack/read-tasks";
import { OAUTH_ORIGIN } from "./origins";
import { clearResumeRecord, writeResumeRecord } from "./resume-record";
export const tabStorage = () => {
  if (window.location.origin !== OAUTH_ORIGIN)
    throw Error("Resume sign-in is available only at romdex.vercel.app.");
  return window.sessionStorage;
};
export const rememberSession = (
  auth: { token: string; expiresAt: number },
  userId: string,
  projectId: string | null,
) => {
  writeResumeRecord(tabStorage(), {
    version: 1,
    instance: YOUTRACK_ORIGIN,
    ...auth,
    userId,
    projectId,
  });
};
export const forgetSession = () => {
  clearResumeRecord(tabStorage());
};
