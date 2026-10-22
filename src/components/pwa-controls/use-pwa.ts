"use client";
import { useEffect, useState } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export const usePwa = () => {
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState(
    "Use your browser menu to install. On iPhone or iPad, choose Share, then Add to Home Screen.",
  );
  useEffect(() => {
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
          registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
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
  }, []);
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
  const reloadToUpdate = () => {
    if (!waiting) return;
    const channel = new MessageChannel();
    const controllerChanged = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      setMessage("Update did not respond. Reload while online to try again.");
    }, 10000);
    const received = (event: MessageEvent<{ blocked: boolean }>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data.blocked) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          controllerChanged,
        );
        setMessage(
          "Close other ROMDex windows, then choose Reload to update again.",
        );
      } else {
        setMessage("Applying update…");
      }
    };
    channel.port1.onmessage = received;
    waiting.postMessage({ type: "ACTIVATE_UPDATE" }, [channel.port2]);
  };
  return {
    canInstall: Boolean(install),
    hasUpdate: Boolean(waiting),
    message,
    installApp,
    reloadToUpdate,
  };
};
