import { setAuthSession } from "@/auth/session";
import { disconnectDelivery } from "@/cloud/session";
import type { SessionRefs } from "./use-session-expiry";

/** Cleanup for a started resume: invalidates it and drops the live session. */
export const resumeCleanup = ({
  sessionRef,
  generationRef,
}: Pick<SessionRefs, "sessionRef" | "generationRef">) => {
  return () => {
    ++generationRef.current;
    disconnectDelivery();
    setAuthSession(null);
    sessionRef.current = null;
  };
};
