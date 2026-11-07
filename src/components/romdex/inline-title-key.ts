import type { KeyboardEvent } from "react";

export type InlineTitleAction = "Enter" | "Tab" | "Escape";

const actions: string[] = ["Enter", "Tab", "Escape"];

/** Reads an inline title key press; null means the key is not ours. */
export const inlineTitleKey = (
  event: KeyboardEvent<HTMLInputElement>,
): { action: InlineTitleAction; outdent: boolean } | null => {
  if (
    event.nativeEvent.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return null;
  if (!actions.includes(event.key)) return null;
  event.preventDefault();
  return { action: event.key as InlineTitleAction, outdent: event.shiftKey };
};
