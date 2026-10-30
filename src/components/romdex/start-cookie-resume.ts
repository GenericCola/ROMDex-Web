import { activateProject } from "@/auth/activate-project";
import { assertCookieHandle, cookieSession } from "@/auth/cookie-client";
import { savedCookieProject } from "@/auth/cookie-preferences";
import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { setAuthSession } from "@/auth/session";
import { rememberSession } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import type { SessionRefs } from "./use-session-expiry";
export const startCookieResume = ({
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
}) => {
  const run = ++generationRef.current;
  const current = () => {
    return run === generationRef.current;
  };
  setBusy(true);
  setRetryable(false);
  setMessage("");
  const restore = async () => {
    try {
      disconnectDelivery();
      setAuthSession(null);
      const auth = await cookieSession();
      if (!current()) return;
      if (!auth) return;
      sessionRef.current = auth;
      const check = () => {
        if (!current() || Date.now() >= auth.expiresAt) return false;
        assertCookieHandle(auth.token);
        return true;
      };
      const saved = savedCookieProject(auth.identity.id);
      const project =
        auth.identity.projects.find((item) => {
          return item.id === saved;
        }) ??
        (auth.identity.projects.length === 1
          ? auth.identity.projects[0]
          : undefined);
      // Only a verified cookie session may migrate away the legacy tab token.
      rememberSession(auth, auth.identity.id, project?.id ?? null);
      setIdentity(auth.identity);
      if (project) {
        const opened = await activateProject(
          auth,
          auth.identity.id,
          project,
          check,
        );
        if (!check()) return;
        setIssues(opened.items);
        setSelected(project);
        setMessage(opened.warning);
      }
    } catch (error) {
      if (!current()) return;
      disconnectDelivery();
      setAuthSession(null);
      setRetryable(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not verify sign-in. Retry; local work is preserved.",
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
