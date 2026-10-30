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
      if (!sessionRef.current || !expired(sessionRef.current.expiresAt)) return;
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
    return () => {
      window.clearInterval(timer);
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
