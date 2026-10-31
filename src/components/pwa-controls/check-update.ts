export const checkRegistrationUpdate = (
  registration: () => Promise<ServiceWorkerRegistration | undefined>,
  message: (value: string) => void,
  waiting: (worker: ServiceWorker | null) => void,
  signal: AbortSignal,
  online: () => boolean = () => {
    return navigator.onLine;
  },
  timeoutMs = 30000,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let settled = false,
      checked = false;
    let current: ServiceWorkerRegistration | undefined;
    const workers = new Set<ServiceWorker>();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", aborted);
      current?.removeEventListener("updatefound", inspect);
      for (const worker of workers)
        worker.removeEventListener("statechange", inspect);
      if (error) reject(error);
      else resolve();
    };
    const aborted = () => {
      finish(new DOMException("Update check cancelled.", "AbortError"));
    };
    const inspect = () => {
      if (settled || !current) return;
      const worker = current.installing;
      if (worker && !workers.has(worker)) {
        workers.add(worker);
        worker.addEventListener("statechange", inspect);
      }
      if (!checked) return;
      if (
        [...workers].some((item) => {
          return item.state === "redundant";
        })
      ) {
        finish(
          Error(
            "Update could not finish installing. Your current app is unchanged; try checking again.",
          ),
        );
      } else if (
        worker &&
        !["installed", "activated", "redundant"].includes(worker.state)
      ) {
        message("Downloading and installing the update…");
      } else if (current.waiting) {
        waiting(current.waiting);
        message(
          "Update ready. Apply it when you are ready; your work will be checked first.",
        );
        finish();
      } else if (
        [...workers].some((item) => {
          return item.state === "installed" || item.state === "activating";
        })
      ) {
        message("Finishing update installation…");
      } else {
        waiting(null);
        message("You have the latest ROMDex app version.");
        finish();
      }
    };
    const timeout = setTimeout(() => {
      finish(
        Error(
          "Update check did not finish. Installation may still be running; check again when online.",
        ),
      );
    }, timeoutMs);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) {
      aborted();
      return;
    }
    if (!online()) {
      finish(
        Error(
          "You are offline. Connect to the internet, then check for updates again.",
        ),
      );
      return;
    }
    message("Checking for updates…");
    void Promise.resolve()
      .then(registration)
      .then(async (result) => {
        if (settled) return;
        if (!result)
          throw Error(
            "The app update service is not ready. Reload while online, then check again.",
          );
        current = result;
        current.addEventListener("updatefound", inspect);
        inspect();
        await current.update();
        if (settled) return;
        checked = true;
        inspect();
      })
      .catch((error: unknown) => {
        finish(
          Error(
            !online()
              ? "You are offline. Connect to the internet, then check for updates again."
              : error instanceof Error
                ? error.message
                : "Could not check for updates. Try again while online.",
          ),
        );
      });
  });
};
