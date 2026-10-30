interface Timers {
  set: (action: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}
export const startOutgoingScheduler = (
  work: () => string | null,
  run: () => void | Promise<void>,
  subscribe: (listener: () => void) => () => void,
  timers: Timers = {
    set: (action, delay) => {
      return setTimeout(action, delay);
    },
    clear: (timer) => {
      return clearTimeout(timer);
    },
  },
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let key: string | null = null;
  let running = false,
    stopped = false,
    failed = false;
  const cancel = () => {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
  };
  const changed = () => {
    if (stopped || failed) return;
    const next = work();
    if (!next) {
      cancel();
      key = null;
      return;
    }
    if (running) return;
    if (timer !== undefined && key === next) return;
    cancel();
    key = next;
    timer = timers.set(() => {
      timer = undefined;
      if (stopped || !work()) return;
      running = true;
      void Promise.resolve()
        .then(() => {
          if (!stopped && work()) return run();
        })
        .catch(() => {
          failed = true;
        })
        .finally(() => {
          running = false;
          changed();
        });
    }, 750);
  };
  const unsubscribe = subscribe(changed);
  changed();
  return () => {
    stopped = true;
    cancel();
    unsubscribe();
  };
};
