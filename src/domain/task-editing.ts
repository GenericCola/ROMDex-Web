const active = new Set<string>();
export const setTaskTextEditing = (key: string, editing: boolean) => {
  if (editing) active.add(key);
  else active.delete(key);
};
export const hasTaskTextEditing = () => {
  return active.size > 0;
};
