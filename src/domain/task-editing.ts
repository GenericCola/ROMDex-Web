import { EditingWindow } from "./editing-window";
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
const window = new EditingWindow(changed);
export const touchTaskTextEditing = (key: string) => {
  if (active.has(key)) window.touch(key);
};
export const setTaskTextEditing = (key: string, editing: boolean) => {
  if (editing) {
    active.add(key);
    window.touch(key);
    return;
  } else {
    window.remove(key);
    active.delete(key);
    composing.delete(key);
  }
  changed();
};
export const setTaskComposition = (key: string, composition: boolean) => {
  if (composition) composing.add(key);
  else {
    composing.delete(key);
    if (active.has(key)) {
      window.touch(key);
      return;
    }
  }
  changed();
};
export const hasTaskTextEditing = () => {
  return active.size > 0;
};
export const hasTaskComposition = () => {
  return composing.size > 0;
};

export const editingTicketIds = () => {
  return new Set(
    [...active, ...composing].map((key) => {
      return key.slice(0, key.lastIndexOf(":"));
    }),
  );
};

export const automaticEditingTicketIds = () => {
  return new Set(
    [...window.keys(), ...composing].map((key) => {
      return key.slice(0, key.lastIndexOf(":"));
    }),
  );
};
