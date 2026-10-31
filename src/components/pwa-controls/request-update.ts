export const requestUpdate = async (
  waiting: ServiceWorker,
  beforeUpdate: (() => Promise<void | (() => void)>) | undefined,
  message: (value: string) => void,
) => {
  const release = await beforeUpdate?.();
  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let channel: MessageChannel | undefined;
    let timeout: number | undefined;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      channel?.port1.close();
      channel?.port2.close();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      release?.();
      if (error)
        reject(
          error instanceof Error ? error : Error("Update activation failed."),
        );
      else resolve();
    };
    const controllerChanged = () => {
      if (finished) return;
      finish();
      window.location.reload();
    };
    const timedOut = () => {
      finish();
      message("Update did not finish. Reload while online to try again.");
    };
    const received = (event: MessageEvent<{ blocked: boolean }>) => {
      if (finished) return;
      if (event.data.blocked) {
        finish();
        message(
          "Close other ROMDex windows, then try applying the update again.",
        );
      } else message("Applying update…");
    };
    try {
      channel = new MessageChannel();
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChanged,
      );
      timeout = window.setTimeout(timedOut, 10000);
      channel.port1.onmessage = received;
      waiting.postMessage({ type: "ACTIVATE_UPDATE" }, [channel.port2]);
    } catch (error) {
      finish(error);
    }
  });
};
