import { assertCookieHandle, isCookieHandle } from "@/auth/cookie-client";
import { expired, setAuthSession } from "@/auth/session";
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
}: SessionRefs & { finishExpired: () => Promise<void> }) => {
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
      ++generationRef.current;
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
      void finishExpired();
    };
    const timer = window.setInterval(check, 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  };
  useEffect(monitor, [
    finishExpired,
    generationRef,
    sessionRef,
    setBusy,
    setMessage,
  ]);
};
