import { useEffect, useRef, useState } from "react";
import { checkRegistrationUpdate } from "./check-update";
export const useUpdateCheck = (
  message: (value: string) => void,
  waiting: (worker: ServiceWorker | null) => void,
) => {
  const [checking, setChecking] = useState(false);
  const registrationRef = useRef<Promise<ServiceWorkerRegistration> | null>(
    null,
  );
  const checkRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      checkRef.current?.abort();
    };
  }, []);
  const checkForUpdates = async () => {
    if (checkRef.current) return;
    if (!("serviceWorker" in navigator)) {
      message("This browser does not support app update checks.");
      return;
    }
    const controller = new AbortController();
    checkRef.current = controller;
    setChecking(true);
    try {
      await checkRegistrationUpdate(
        () => {
          return (
            registrationRef.current ??
            navigator.serviceWorker.getRegistration("/")
          );
        },
        message,
        waiting,
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        message(
          error instanceof Error
            ? error.message
            : "Could not check for updates. Try again while online.",
        );
    } finally {
      if (checkRef.current === controller) checkRef.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  };
  return { checking, checkForUpdates, registrationRef };
};
