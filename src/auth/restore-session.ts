import { readIdentity } from "./identity";
import { prepareProject } from "./open-workspace";
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
    if (Date.now() >= record.expiresAt) throw Error("Saved sign-in expired.");
  };
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
    const issues = project
      ? await projectOpener(record.token, identity.id, project, isCurrent)
      : [];
    check();
    return { record, identity, project, issues };
  } catch (error) {
    // A cancelled old run must never erase a newer sign-in's record.
    assertCurrent();
    clearResumeRecord(storage);
    throw error;
  }
};
