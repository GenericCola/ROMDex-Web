/** The Refresh control asks every reader to read YouTrack again now. */
const listeners = new Set<() => void>();
export const requestRefresh = () => {
  for (const listener of listeners) listener();
};
export const subscribeRefresh = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
