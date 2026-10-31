"use client";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useState } from "react";
import { requestUpdate } from "./request-update";
import { createUpdateActivation } from "./update-activation";
import { useUpdateCheck } from "./use-update-check";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export const usePwa = (
  beforeUpdate: () => Promise<
    void | (() => void)
  > = workspaceStore.prepareUpdate,
) => {
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState(
    "Chrome: use Install ROMDex or the address-bar install icon. Firefox on Windows: use the address-bar web apps button. On iPhone or iPad, choose Share, then Add to Home Screen.",
  );
  const {
    checking,
    checkForUpdates: check,
    registrationRef,
  } = useUpdateCheck(setMessage, setWaiting);
  const [applying, setApplying] = useState(false);
  const [activation] = useState(() => {
    return createUpdateActivation(setApplying);
  });
  const checkForUpdates = async () => {
    if (activation.busy()) return;
    await check();
  };
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches)
      setMessage("ROMDex is running as an installed app.");
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => {
      setInstall(null);
      setMessage("ROMDex is installed.");
    };
    const inspect = () => {
      if (
        !disposed &&
        registration?.waiting &&
        navigator.serviceWorker.controller
      )
        setWaiting(registration.waiting);
    };
    const track = () => {
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", inspect, options);
      inspect();
    };
    window.addEventListener("beforeinstallprompt", captureInstall, options);
    window.addEventListener("appinstalled", installed, options);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = async () => {
        try {
          const pending = navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
          registrationRef.current = pending;
          try {
            registration = await pending;
          } catch (error) {
            if (registrationRef.current === pending)
              registrationRef.current = null;
            throw error;
          }
          if (disposed) return;
          registration.addEventListener("updatefound", track, options);
          track();
          inspect();
        } catch {
          if (!disposed)
            setMessage(
              "Offline shell setup failed. Reload while online to try again.",
            );
        }
      };
      void register();
    }
    const cleanup = () => {
      disposed = true;
      listeners.abort();
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", installed);
      registration?.removeEventListener("updatefound", track);
      installing?.removeEventListener("statechange", inspect);
    };
    return cleanup;
  }, [registrationRef]);
  const installApp = async () => {
    if (!install) return;
    try {
      await install.prompt();
      const choice = await install.userChoice;
      setInstall(null);
      setMessage(
        choice.outcome === "accepted"
          ? "Installation requested."
          : "Installation dismissed.",
      );
    } catch {
      setMessage("Installation failed. Use the browser menu to try again.");
    }
  };
  const reloadToUpdate = async () => {
    if (!waiting || checking) return;
    try {
      await activation.run(() => {
        return requestUpdate(waiting, beforeUpdate, setMessage);
      });
    } catch {
      setMessage("Save or export your drafts before applying the update.");
    }
  };
  return {
    checking,
    applying,
    checkForUpdates,
    canInstall: Boolean(install),
    hasUpdate: Boolean(waiting),
    message,
    installApp,
    reloadToUpdate,
  };
};
