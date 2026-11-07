import { connectOpenedProject } from "@/auth/activate-project";
import { assertCookieHandle, cookieSession } from "@/auth/cookie-client";
import { flushLocal } from "@/auth/flush-local";
import {
  isNetworkFailure,
  offlineAccount,
  type OfflineAccount,
} from "@/auth/offline-account";
import { openOfflineWorkspace } from "@/auth/open-workspace";
import { expired } from "@/auth/session";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { startCookieResume } from "./start-cookie-resume";
type ResumeOptions = Parameters<typeof startCookieResume>[0];
// Cookie resume that falls back to saved work offline (PMON-628). Delivery stays
// off until a later session check, run on `online` or window focus, succeeds.
export const useOfflineResume = (options: ResumeOptions) => {
  const [offline, setOffline] = useState(false);
  const checkingRef = useRef(false);
  const { sessionRef, generationRef, setIdentity, setMessage } = options;
  const openOffline = async (isCurrent: () => boolean) => {
    const account = offlineAccount();
    if (!account) return false;
    const { userId, project } = account;
    if (!(await openOfflineWorkspace(userId, project.id, isCurrent)))
      return true;
    setIdentity({ id: userId, name: userId, projects: [project] });
    options.setSelected(project);
    setOffline(true);
    return true;
  };
  const resume = () => {
    setOffline(false);
    return startCookieResume({ ...options, openOffline });
  };
  const reconnect = async (account: OfflineAccount) => {
    const run = ++generationRef.current;
    const auth = await cookieSession(false);
    const { userId, project } = account;
    if (run !== generationRef.current) return;
    const same =
      auth?.identity.id === userId &&
      auth.identity.projects.some((item) => {
        return item.id === project.id;
      });
    if (!auth || !same) {
      // A 401 or another account goes through the normal sign-in path.
      await flushLocal();
      resume();
      return;
    }
    sessionRef.current = auth;
    const check = () => {
      if (run !== generationRef.current || expired(auth.expiresAt))
        throw Error("The sign-in session changed.");
      assertCookieHandle(auth.token);
    };
    const warning = await connectOpenedProject(auth, userId, project, check);
    setIdentity(auth.identity);
    setOffline(false);
    setMessage([auth.notice, warning].filter(Boolean).join(" "));
  };
  // Effect events read the latest state without re-subscribing listeners.
  const checkAgain = useEffectEvent(() => {
    const account = offlineAccount();
    if (checkingRef.current || !account || !navigator.onLine) return;
    checkingRef.current = true;
    const recheck = (error: unknown) => {
      // Still offline: keep editing locally and wait for the next event.
      if (!isNetworkFailure(error)) resume();
    };
    const done = () => {
      checkingRef.current = false;
    };
    void reconnect(account).catch(recheck).finally(done);
  });
  // Inline effects: lint lets effect events be called only from inline effects.
  useEffect(() => {
    if (!offline) return;
    const check = () => {
      checkAgain();
    };
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
    };
  }, [offline]);
  const startResume = useEffectEvent(() => {
    return resume();
  });
  useEffect(() => {
    return startResume();
  }, []);
  return { offline, resume };
};
