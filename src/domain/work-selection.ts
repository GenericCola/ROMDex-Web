// Session-only desktop selection. Hidden or out-of-scope rows are never selected.
export interface WorkSelection {
  ids: string[];
  anchor: string | null;
}
export interface SelectionModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}
export const reconcileSelection = (
  selection: WorkSelection,
  visibleIds: string[],
): WorkSelection => {
  const visible = new Set(visibleIds);
  return {
    ids: selection.ids.filter((id) => {
      return visible.has(id);
    }),
    anchor:
      selection.anchor && visible.has(selection.anchor)
        ? selection.anchor
        : null,
  };
};
export const toggleSelection = (
  selection: WorkSelection,
  id: string,
  visibleIds: string[],
  modifiers: SelectionModifiers = {},
): WorkSelection => {
  const current = reconcileSelection(selection, visibleIds);
  const end = visibleIds.indexOf(id),
    start = current.anchor === null ? -1 : visibleIds.indexOf(current.anchor);
  if (end < 0) return current;
  const ids = new Set(current.ids);
  if (modifiers.shiftKey && start >= 0) {
    if (!modifiers.ctrlKey && !modifiers.metaKey) ids.clear();
    for (const key of visibleIds.slice(
      Math.min(start, end),
      Math.max(start, end) + 1,
    ))
      ids.add(key);
  } else {
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    current.anchor = id;
  }
  return { ids: [...ids], anchor: current.anchor };
};
export const remapSelection = (
  selection: WorkSelection,
  mapping: Record<string, string>,
): WorkSelection => {
  return {
    ids: [
      ...new Set(
        selection.ids.map((id) => {
          return mapping[id] ?? id;
        }),
      ),
    ],
    anchor:
      selection.anchor === null
        ? null
        : (mapping[selection.anchor] ?? selection.anchor),
  };
};
