import type {
  AuthorizedProject,
  ProjectIssue,
  YouTrackIdentity,
} from "@/auth/identity";
import { readIdentity } from "@/auth/identity";
import { prepareProject } from "@/auth/open-workspace";
import { signInPopup } from "@/auth/popup";
import { expired, setAuthSession } from "@/auth/session";
import { disconnectDelivery } from "@/cloud/session";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { flushWorkspaceWork } from "@/domain/workspace-work";
import { useEffect, useRef, useState } from "react";
export const useAuthWorkspace = () => {
  const [identity, setIdentity] = useState<YouTrackIdentity | null>(null);
  const [selected, setSelected] = useState<AuthorizedProject | null>(null);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [busy, setBusy] = useState(false);
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
    if (workspaceStore.getSnapshot().delivering)
      throw Error("Finish delivery before switching projects or signing out.");
    await flushDraftEditors();
    await flushWorkspaceWork();
    if (workspaceStore.getSnapshot().ready) await workspaceStore.flush();
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
      await closeProject();
      const isCurrent = () => {
        return run === generationRef.current && sessionRef.current === auth;
      };
      const items = await prepareProject(
        auth.token,
        identity.id,
        project,
        isCurrent,
      );
      if (!isCurrent()) return;
      setAuthSession({ ...auth, userId: identity.id, projectId: project.id });
      setIssues(items);
      setSelected(project);
    } catch (error) {
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
      await closeProject();
      ++generationRef.current;
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
      await flushDraftEditors();
      await flushWorkspaceWork();
      if (workspaceStore.getSnapshot().delivering)
        throw Error("Delivery is finishing.");
      if (workspaceStore.getSnapshot().ready) await workspaceStore.flush();
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
  const monitorExpiry = () => {
    const check = () => {
      if (sessionRef.current && expired(sessionRef.current.expiresAt)) {
        ++generationRef.current;
        disconnectDelivery();
        setAuthSession(null);
        sessionRef.current = null;
        setBusy(true);
        setMessage("Session expired. Finishing local saves…");
        void finishExpired();
      }
    };
    const timer = window.setInterval(check, 1000);
    return () => {
      window.clearInterval(timer);
    };
  };
  useEffect(monitorExpiry, []);
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
