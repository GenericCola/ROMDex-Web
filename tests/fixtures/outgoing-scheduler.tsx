import { startOutgoingScheduler } from "../../src/cloud/outgoing-scheduler";
export const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
export const harness = (run: () => void | Promise<void>) => {
  let now = 0,
    serial = 0,
    key: string | null = null;
  let notify = () => {
    return undefined;
  };
  let unsubscribed = false;
  const pending = new Map<number, { at: number; action: () => void }>();
  const stop = startOutgoingScheduler(
    () => {
      return key;
    },
    run,
    (listener) => {
      notify = listener;
      return () => {
        unsubscribed = true;
      };
    },
    {
      set: (action, delay) => {
        const id = ++serial;
        pending.set(id, { at: now + delay, action });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clear: (id) => {
        pending.delete(id as unknown as number);
      },
    },
  );
  return {
    stop,
    change: (next: string | null) => {
      key = next;
      notify();
    },
    tick: (ms: number) => {
      now += ms;
      for (const [id, timer] of [...pending])
        if (timer.at <= now) {
          pending.delete(id);
          timer.action();
        }
    },
    count: () => {
      return pending.size;
    },
    stopped: () => {
      return unsubscribed;
    },
  };
};
