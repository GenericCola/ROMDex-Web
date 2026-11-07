/*
 * Keeps ROMDex active in one window (tab or installed app) at a time. The
 * active window holds a Web Lock. Another window shows a notice; "Use here"
 * asks the active window over a BroadcastChannel to save and let go, then
 * takes the lock. If the other window does not answer, the lock is taken
 * anyway after a while; saves stay protected by the workspace revision check.
 */
export type WindowRole = "checking" | "active" | "elsewhere";
const LOCK = "romdex-active-window";
const STEAL_AFTER_MS = 10_000;
export interface WindowDeps {
  locks: LockManager | undefined;
  channel: BroadcastChannel | undefined;
  /** Saves and stops this window's workspace before another takes over. */
  handOver: () => Promise<void>;
  /** Starts again from saved data after this window was handed away. */
  reload: () => void;
}
const ignore = () => {
  return undefined;
};
export const claimWindow = (
  deps: WindowDeps,
  setRole: (role: WindowRole) => void,
) => {
  const { locks, channel } = deps;
  if (!locks) {
    // Without Web Locks the revision check still refuses stale saves.
    setRole("active");
    return { takeOver: deps.reload, stop: ignore };
  }
  const abort = new AbortController();
  let release: (() => void) | undefined;
  let steal: ReturnType<typeof setTimeout> | undefined;
  let handedAway = false,
    asking = false;
  const hold = (lock: Lock | null) => {
    if (!lock) {
      setRole("elsewhere");
      return undefined;
    }
    clearTimeout(steal);
    if (handedAway) {
      // Start again from saved data; the reloaded page takes the lock again.
      deps.reload();
      return undefined;
    }
    setRole("active");
    const keep = (resolve: () => void) => {
      release = resolve;
    };
    return new Promise<void>(keep);
  };
  const lost = () => {
    // Stolen by a window that got no answer, or a request was cancelled.
    if (abort.signal.aborted || !release) return;
    release = undefined;
    handedAway = true;
    setRole("elsewhere");
    void deps.handOver().catch(ignore);
  };
  const request = (options: LockOptions, signal = abort.signal) => {
    return locks.request(LOCK, { ...options, signal }, hold).catch(lost);
  };
  const letGo = async () => {
    if (!release) return;
    await deps.handOver().catch(ignore);
    handedAway = true;
    setRole("elsewhere");
    release();
    release = undefined;
  };
  const received = (event: MessageEvent<unknown>) => {
    if (event.data === "take") void letGo();
  };
  const takeOver = () => {
    if (asking || release) return;
    asking = true;
    channel?.postMessage("take");
    const waiting = new AbortController();
    const stopWaiting = () => {
      waiting.abort();
    };
    abort.signal.addEventListener("abort", stopWaiting);
    void request({}, waiting.signal);
    const force = () => {
      // The active window did not answer: take the lock from it. A stealing
      // request may not carry a signal.
      waiting.abort();
      void locks.request(LOCK, { steal: true }, hold).catch(lost);
    };
    steal = setTimeout(force, STEAL_AFTER_MS);
  };
  channel?.addEventListener("message", received);
  void request({ ifAvailable: true });
  const stop = () => {
    clearTimeout(steal);
    abort.abort();
    release?.();
    release = undefined;
    channel?.removeEventListener("message", received);
    channel?.close();
  };
  return { takeOver, stop };
};
