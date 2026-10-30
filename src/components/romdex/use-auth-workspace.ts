import { flushLocal } from "@/auth/flush-local";
import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { readIdentity } from "@/auth/identity";
import { prepareProject } from "@/auth/open-workspace";
import { signInPopup } from "@/auth/popup";
import { expired, setAuthSession } from "@/auth/session";
import { forgetSession, rememberSession } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import { useEffect, useRef, useState } from "react";
import { startResume } from "./start-auth-resume";
import { useSessionExpiry } from "./use-session-expiry";
export const useAuthWorkspace = () => {
  const [identity, setIdentity] = useState<YouTrackIdentity | null>(null);
  const [selected, setSelected] = useState<AuthorizedProject | null>(null);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [busy, setBusy] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const sessionRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const generationRef = useRef(0);
  const signIn = async () => {
    const run = ++generationRef.current;
    setBusy(true);
    setMessage("");
    try {
      const auth = await signInPopup();
      const person = await readIdentity(auth.token);
      if (run !== generationRef.current) return;
      rememberSession(auth, person.id, null);
      sessionRef.current = auth;
      setIdentity(person);
    } catch (error) {
      if (run === generationRef.current)
        setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      if (run === generationRef.current) setBusy(false);
    }
  };
  const closeProject = async () => {
    await flushLocal();
    disconnectDelivery();
    setAuthSession(null);
    setSelected(null);
    setIssues([]);
  };
  const choose = async (project: AuthorizedProject) => {
    const auth = sessionRef.current;
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
      const items = await prepareProject(
        auth.token,
        identity.id,
        project,
        isCurrent,
      );
      if (!isCurrent()) return;
      rememberSession(auth, identity.id, project.id);
      setAuthSession({ ...auth, userId: identity.id, projectId: project.id });
      setIssues(items);
      setSelected(project);
    } catch (error) {
      if (run !== generationRef.current) return;
      setMessage(
        error instanceof Error ? error.message : "Project could not open.",
      );
    } finally {
      if (run === generationRef.current) setBusy(false);
    }
  };
  const signOut = async () => {
    if (recoveryBlocked) return;
    setBusy(true);
    try {
      forgetSession();
      ++generationRef.current;
      await closeProject();
      sessionRef.current = null;
      setIdentity(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Save local work first.",
      );
    } finally {
      setBusy(false);
    }
  };
  const finishExpired = async () => {
    setBusy(true);
    try {
      await flushLocal();
      setRecoveryBlocked(false);
      setIdentity(null);
      setSelected(null);
      setIssues([]);
      setBusy(false);
      setMessage("Session expired. Sign in again; local work is preserved.");
    } catch {
      setRecoveryBlocked(true);
      setBusy(false);
      setMessage(
        "Export recovery or retry saving. Account switching stays blocked.",
      );
    }
  };
  const session = { sessionRef, generationRef, setBusy, setMessage };
  useSessionExpiry({ ...session, finishExpired });
  const resume = () => {
    return startResume({
      sessionRef,
      generationRef,
      setBusy,
      setMessage,
      setIdentity,
      setSelected,
      setIssues,
    });
  };
  useEffect(resume, []);
  return {
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
