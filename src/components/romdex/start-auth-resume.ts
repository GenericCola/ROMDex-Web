import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { OAUTH_ORIGIN } from "@/auth/origins";
import { restoreSession } from "@/auth/restore-session";
import { ResumeRetryable } from "@/auth/resume-failure";
import { readResumeRecord } from "@/auth/resume-record";
import { setAuthSession } from "@/auth/session";
import { tabStorage } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import type { SessionRefs } from "./use-session-expiry";
export const startResume = ({
  sessionRef,
  generationRef,
  setBusy,
  setMessage,
  setIdentity,
  setSelected,
  setIssues,
  setRetryable,
}: SessionRefs & {
  setRetryable: (value: boolean) => void;
  setIdentity: (value: YouTrackIdentity | null) => void;
  setSelected: (value: AuthorizedProject | null) => void;
  setIssues: (value: ProjectIssue[]) => void;
}) => {
  const run = ++generationRef.current;
  sessionRef.current = null;
  setBusy(true);
  setMessage("");
  setRetryable(false);
  setIdentity(null);
  setSelected(null);
  setIssues([]);
  const assertCurrent = () => {
    if (run !== generationRef.current)
      throw Error("The sign-in session changed.");
  };
  const restore = async () => {
    try {
      disconnectDelivery();
      setAuthSession(null);
      if (window.location.origin !== OAUTH_ORIGIN) return;
      const value = await restoreSession(tabStorage(), assertCurrent);
      assertCurrent();
      if (!value) return;
      const { record, identity, project, issues } = value;
      if (Date.now() >= record.expiresAt) throw Error("Saved sign-in expired.");
      sessionRef.current = { token: record.token, expiresAt: record.expiresAt };
      if (project)
        setAuthSession({
          ...sessionRef.current,
          userId: identity.id,
          projectId: project.id,
        });
      setIdentity(identity);
      setSelected(project);
      setIssues(issues);
    } catch (error) {
      if (run === generationRef.current) {
        let retry = error instanceof ResumeRetryable;
        if (retry) {
          try {
            const retained = readResumeRecord(tabStorage());
            retry = !!retained;
            if (retained)
              sessionRef.current = {
                token: retained.token,
                expiresAt: retained.expiresAt,
              };
          } catch {
            retry = false;
          }
        }
        setRetryable(retry);
        setMessage(
          retry && error instanceof ResumeRetryable
            ? error.message
            : "Could not resume sign-in. Sign in again; local work is preserved.",
        );
      }
    } finally {
      if (run === generationRef.current) setBusy(false);
    }
  };
  void restore();
  return () => {
    ++generationRef.current;
    disconnectDelivery();
    setAuthSession(null);
    sessionRef.current = null;
  };
};
