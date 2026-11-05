import {
  activateProject,
  closeProjectConnection,
} from "@/auth/activate-project";
import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { ResumeRejected } from "@/auth/resume-failure";
import { expired, setAuthSession } from "@/auth/session";
import { rememberSession } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import { useEffect, useRef, useState } from "react";
import { cookieSignIn } from "./cookie-sign-in";
import { cookieSignOut } from "./cookie-sign-out";
import { finishExpiredSession } from "./finish-expired-session";
import { startCookieResume } from "./start-cookie-resume";
import { useSessionExpiry } from "./use-session-expiry";
export const useAuthWorkspace = () => {
  const [identity, setIdentity] = useState<YouTrackIdentity | null>(null);
  const [selected, setSelected] = useState<AuthorizedProject | null>(null);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [busy, setBusy] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [message, setMessage] = useState("");
  const sessionRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const generationRef = useRef(0);
  const signIn = async (rememberDevice = false) => {
    if (recoveryBlocked || busy) return;
    setRetryable(false);
    const run = ++generationRef.current;
    await cookieSignIn(
      () => {
        return run === generationRef.current;
      },
      () => {
        disconnectDelivery();
        setAuthSession(null);
        sessionRef.current = null;
        setIdentity(null);
        setSelected(null);
        setIssues([]);
      },
      setBusy,
      setMessage,
      rememberDevice,
    );
  };
  const closeProject = async () => {
    await closeProjectConnection();
    setSelected(null);
    setIssues([]);
  };
  const choose = async (project: AuthorizedProject) => {
    const auth = sessionRef.current;
    if (busy || recoveryBlocked) return;
    if (!auth || !identity || expired(auth.expiresAt)) return;
    setBusy(true);
    setMessage("");
    const run = ++generationRef.current;
    try {
      rememberSession(auth, identity.id, null);
      await closeProject();
      const isCurrent = () => {
        return (
          run === generationRef.current &&
          sessionRef.current === auth &&
          !expired(auth.expiresAt)
        );
      };
      const { items, warning } = await activateProject(
        auth,
        identity.id,
        project,
        isCurrent,
      );
      if (!isCurrent()) return;
      setMessage(warning);
      setIssues(items);
      setSelected(project);
    } catch (error) {
      if (run !== generationRef.current) return;
      if (error instanceof ResumeRejected) {
        sessionRef.current = null;
        setIdentity(null);
      }
      setMessage(
        error instanceof Error ? error.message : "Project could not open.",
      );
    } finally {
      if (run === generationRef.current) setBusy(false);
    }
  };
  const signOut = async () => {
    if (recoveryBlocked || busy) return;
    await cookieSignOut(
      closeProject,
      () => {
        ++generationRef.current;
        sessionRef.current = null;
        setIdentity(null);
      },
      setBusy,
      setMessage,
    );
  };
  const finishExpired = () => {
    setRetryable(false);
    return finishExpiredSession(setBusy, setRecoveryBlocked, setMessage, () => {
      setIdentity(null);
      setSelected(null);
      setIssues([]);
    });
  };
  const session = { sessionRef, generationRef, setBusy, setMessage };
  const resume = () => {
    return startCookieResume({
      sessionRef,
      generationRef,
      setBusy,
      setMessage,
      setIdentity,
      setSelected,
      setIssues,
      setRetryable,
    });
  };
  useSessionExpiry({ ...session, finishExpired, resume });
  useEffect(resume, []);
  return {
    retryable,
    retryResume: () => {
      if (!recoveryBlocked && !busy) resume();
    },
    identity,
    selected,
    issues,
    busy,
    message,
    choose,
    signIn,
    signOut,
    recoveryBlocked,
    finishExpired,
  };
};
