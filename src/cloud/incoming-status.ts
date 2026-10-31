let message = "";
const listeners = new Set<() => void>();
export const incomingMessage = () => {
  return message;
};
export const subscribeIncoming = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const setIncomingMessage = (value: string) => {
  if (value === message) return;
  message = value;
  for (const listener of listeners) listener();
};
