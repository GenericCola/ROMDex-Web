export const createUpdateActivation = (changed: (busy: boolean) => void) => {
  let pending: Promise<void> | null = null;
  const run = (action: () => Promise<void>) => {
    if (pending) return pending;
    changed(true);
    pending = Promise.resolve()
      .then(action)
      .finally(() => {
        pending = null;
        changed(false);
      });
    return pending;
  };
  return {
    run,
    busy: () => {
      return pending !== null;
    },
  };
};
