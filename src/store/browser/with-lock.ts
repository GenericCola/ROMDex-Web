/** Runs one store job at a time across tabs, where the browser has Web Locks. */
export const withLock = async <T>(name: string, run: () => Promise<T>) => {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return run();
  return navigator.locks.request(name, run) as Promise<T>;
};
