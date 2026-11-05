import { activateProject } from "@/auth/activate-project";
import { assertCookieHandle, cookieSession } from "@/auth/cookie-client";
import { preferredCookieProject } from "@/auth/cookie-preferences";
import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { setAuthSession } from "@/auth/session";
import { rememberSession } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import type { SessionRefs } from "./use-session-expiry";
export const startCookieResume = (
  {
    sessionRef,
    generationRef,
    setBusy,
    setMessage,
    setIdentity,
    setSelected,
    setIssues,
    setRetryable,
  }: SessionRefs & {
    setIdentity: (value: YouTrackIdentity | null) => void;
    setSelected: (value: AuthorizedProject | null) => void;
    setIssues: (value: ProjectIssue[]) => void;
    setRetryable: (value: boolean) => void;
  },
  openProject = activateProject,
) => {
  const run = ++generationRef.current;
  const current = () => {
    return run === generationRef.current;
  };
  sessionRef.current = null;
  setIdentity(null);
  setSelected(null);
  setIssues([]);
  setBusy(true);
  setRetryable(false);
  setMessage("");
  const restore = async () => {
    let project: AuthorizedProject | undefined;
    try {
      disconnectDelivery();
      setAuthSession(null);
      const auth = await cookieSession();
      if (!current()) return;
      if (!auth) return;
      sessionRef.current = auth;
      const check = () => {
        if (!current()) return false;
        if (Date.now() >= auth.expiresAt)
          throw Error(
            "Sign-in expired. Sign in again; local work is preserved.",
          );
        assertCookieHandle(auth.token);
        return true;
      };
      project = preferredCookieProject(auth.identity);
      // Only a verified cookie session may migrate away the legacy tab token.
      rememberSession(auth, auth.identity.id, project?.id ?? null);
      setMessage(auth.notice);
      if (project) {
        const opened = await openProject(
          auth,
          auth.identity.id,
          project,
          check,
        );
        if (!check()) return;
        setIssues(opened.items);
        setSelected(project);
        setMessage([auth.notice, opened.warning].filter(Boolean).join(" "));
      }
      if (check()) setIdentity(auth.identity);
    } catch (error) {
      if (!current()) return;
      disconnectDelivery();
      setAuthSession(null);
      sessionRef.current = null;
      setSelected(null);
      setIssues([]);
      setRetryable(true);
      setMessage(
        (project ? `Could not open ${project.shortName}. ` : "") +
          (error instanceof Error
            ? error.message
            : "Could not verify sign-in. Retry; local work is preserved."),
      );
    } finally {
      if (current()) setBusy(false);
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
