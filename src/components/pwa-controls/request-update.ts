export const requestUpdate = async (
  waiting: ServiceWorker,
  beforeUpdate: (() => Promise<void | (() => void)>) | undefined,
  message: (value: string) => void,
) => {
  const release = await beforeUpdate?.();
  const channel = new MessageChannel();
  const cleanup = () => {
    window.clearTimeout(timeout);
    channel.port1.close();
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      controllerChanged,
    );
    release?.();
  };
  const controllerChanged = () => {
    cleanup();
    window.location.reload();
  };
  const timedOut = () => {
    cleanup();
    message("Update did not finish. Reload while online to try again.");
  };
  const received = (event: MessageEvent<{ blocked: boolean }>) => {
    if (event.data.blocked) {
      cleanup();
      message(
        "Close other ROMDex windows, then choose Reload to update again.",
      );
    } else message("Applying update…");
  };
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    controllerChanged,
  );
  const timeout = window.setTimeout(timedOut, 10000);
  channel.port1.onmessage = received;
  try {
    waiting.postMessage({ type: "ACTIVATE_UPDATE" }, [channel.port2]);
  } catch (error) {
    cleanup();
    throw error;
  }
};
