import { YouTrackHttpError } from "@/youtrack/http-error";
import { readIdentity } from "./identity";
import { prepareProject } from "./open-workspace";
import { ResumeRejected, ResumeRetryable } from "./resume-failure";
import {
  clearResumeRecord,
  readResumeRecord,
  type ResumeStorage,
} from "./resume-record";
import { verifyResume } from "./verify-resume";
// Dependencies are injected for synthetic acceptance; production uses the same
// permission-checked opener as interactive sign-in. No delivery is enabled.
export const restoreSession = async (
  storage: ResumeStorage,
  assertCurrent: () => void,
  identityReader = readIdentity,
  projectOpener = prepareProject,
) => {
  const record = readResumeRecord(storage);
  if (!record) return null;
  const check = () => {
    assertCurrent();
    if (Date.now() >= record.expiresAt)
      throw new ResumeRejected("Saved sign-in expired.");
  };
  let phase = "identity and project permissions";
  try {
    const { identity, project } = await verifyResume(
      record,
      identityReader,
      check,
    );
    const isCurrent = () => {
      try {
        check();
        return true;
      } catch {
        return false;
      }
    };
    phase = "project data or local workspace";
    const issues = project
      ? await projectOpener(record.token, identity.id, project, isCurrent)
      : [];
    check();
    return { record, identity, project, issues };
  } catch (error) {
    // A cancelled old run must never erase a newer sign-in's record.
    assertCurrent();
    if (
      Date.now() >= record.expiresAt ||
      error instanceof ResumeRejected ||
      (error instanceof YouTrackHttpError && [401, 403].includes(error.status))
    ) {
      clearResumeRecord(storage);
      throw new ResumeRejected(
        "Saved sign-in expired or access changed. Sign in again; local work is preserved.",
      );
    }
    throw new ResumeRetryable(
      "Could not verify " +
        phase +
        ". Your existing sign-in is retained until its original expiry. Retry verification; no workspace is shown until checks pass.",
    );
  }
};
