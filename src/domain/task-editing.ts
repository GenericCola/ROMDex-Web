const listeners = new Set<() => void>();
export const subscribeTaskEditing = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const active = new Set<string>();
const composing = new Set<string>();
const changed = () => {
  for (const listener of listeners) listener();
};
export const setTaskTextEditing = (key: string, editing: boolean) => {
  if (editing) active.add(key);
  else {
    active.delete(key);
    composing.delete(key);
  }
  changed();
};
export const setTaskComposition = (key: string, composition: boolean) => {
  if (composition) composing.add(key);
  else composing.delete(key);
  changed();
};
export const hasTaskTextEditing = () => {
  return active.size > 0;
};
export const hasTaskComposition = () => {
  return composing.size > 0;
};
