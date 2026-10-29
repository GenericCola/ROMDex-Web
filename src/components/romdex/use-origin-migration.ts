"use clientRef";
import {
  applyCorsMigration,
  readCorsMigration,
  type CorsMigrationPreview,
} from "@/auth/cors-migration";
import { readIdentity } from "@/auth/identity";
import { LEGACY_ORIGIN } from "@/auth/oauth";
import { signInPopup } from "@/auth/popup";
import { setAuthSession } from "@/auth/session";
import { sessionRequest, type YouTrackRequest } from "@/youtrack/request";
import { useEffect, useRef, useState } from "react";
export const useOriginMigration = () => {
  const clientRef = useRef<YouTrackRequest | null>(null);
  const runningRef = useRef(false);
  const disposedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CorsMigrationPreview | null>(null);
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const setup = () => {
    disposedRef.current = false;
    setLegacy(window.location.origin === LEGACY_ORIGIN);
    return () => {
      disposedRef.current = true;
      clientRef.current = null;
      setAuthSession(null);
    };
  };
  useEffect(setup, []);
  const assertOrigin = () => {
    if (
      window.location.origin !== LEGACY_ORIGIN ||
      window.location.pathname !== "/origin-migration/"
    )
      throw Error("Use the existing ROMDex migration address.");
  };
  const run = async (action: () => Promise<void>) => {
    assertOrigin();
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage(
        "The administrator request could not complete. Check your existing permissions and connection. No automatic retry is made.",
      );
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  };
  const login = () => {
    void run(async () => {
      const auth = await signInPopup(true);
      if (disposedRef.current) return;
      const person = await readIdentity(auth.token);
      if (disposedRef.current) return;
      setAuthSession({
        ...auth,
        userId: person.id,
        projectId: "origin-migration",
      });
      clientRef.current = sessionRequest(auth.token);
      setIdentity(person.name);
      setPreview(await readCorsMigration(clientRef.current));
    });
  };
  const inspect = () => {
    void run(async () => {
      if (!clientRef.current) return;
      const current = await readCorsMigration(clientRef.current);
      setPreview(current);
      setConfirmed(false);
      setMessage(
        current.needed
          ? "The new origin is not present. This is read-only verification, not permission to retry an uncertain write."
          : "Verified: the new address is saved in YouTrack's allowed origins.",
      );
    });
  };
  const apply = () => {
    void run(async () => {
      if (!clientRef.current || !preview || !confirmed || dispatched) return;
      setDispatched(true);
      const result = await applyCorsMigration(clientRef.current, preview);
      setMessage(result.message);
      if (result.current) setPreview(result.current);
      setConfirmed(false);
    });
  };
  return {
    busy,
    preview,
    identity,
    message,
    confirmed,
    setConfirmed,
    dispatched,
    legacy,
    login,
    inspect,
    apply,
  };
};
