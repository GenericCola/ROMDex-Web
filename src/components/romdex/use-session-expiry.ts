import { assertCookieHandle, isCookieHandle } from "@/auth/cookie-client";
import { expired, setAuthSession, subscribeAuthSession } from "@/auth/session";
import { forgetSession } from "@/auth/tab-session";
import { disconnectDelivery } from "@/cloud/session";
import { useEffect, type RefObject } from "react";
export interface SessionRefs {
  sessionRef: RefObject<{ token: string; expiresAt: number } | null>;
  generationRef: RefObject<number>;
  setBusy: (value: boolean) => void;
  setMessage: (value: string) => void;
}
export const useSessionExpiry = ({
  sessionRef,
  generationRef,
  setBusy,
  setMessage,
  finishExpired,
  resume,
}: SessionRefs & {
  finishExpired: () => Promise<boolean>;
  resume: () => unknown;
}) => {
  const monitor = () => {
    const check = () => {
      if (!sessionRef.current) return;
      let changed = false;
      try {
        if (isCookieHandle(sessionRef.current.token))
          assertCookieHandle(sessionRef.current.token);
      } catch {
        changed = true;
      }
      if (!changed && !expired(sessionRef.current.expiresAt)) return;
      const canRenew = !changed && isCookieHandle(sessionRef.current.token);
      const run = ++generationRef.current;
      disconnectDelivery();
      setAuthSession(null);
      sessionRef.current = null;
      setBusy(true);
      try {
        forgetSession();
      } catch {
        // The persisted expiry is independently enforced before any resume.
        setMessage("Session expired. Browser storage could not be cleared.");
      }
      void finishExpired().then((saved) => {
        if (saved && canRenew && run === generationRef.current) resume();
      });
    };
    // One timer at the session's expiry, re-armed whenever the session
    // changes; focus and visibility catch a cookie changed elsewhere.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      const run = () => {
        check();
        if (sessionRef.current) arm();
      };
      timer = undefined;
      if (!sessionRef.current) return;
      // Browsers cap timers near 24.8 days; a longer session re-arms.
      const wait = Math.min(
        sessionRef.current.expiresAt - Date.now(),
        2 ** 31 - 1,
      );
      timer = setTimeout(run, Math.max(wait, 0));
    };
    const changed = () => {
      // The session ref is set next to the auth session; arm after both.
      queueMicrotask(arm);
    };
    const stopListening = subscribeAuthSession(changed);
    arm();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      stopListening();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  };
  useEffect(monitor, [
    finishExpired,
    resume,
    generationRef,
    sessionRef,
    setBusy,
    setMessage,
  ]);
};
