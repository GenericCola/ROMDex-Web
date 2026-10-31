import type { JsonObject } from "./json";
interface EditorDraft {
  ticketIds?: string[];
  label?: string;
  dirty: () => boolean;
  capture?: () => JsonObject;
  flush: () => Promise<void>;
}
const editors = new Set<EditorDraft>();
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};
export const subscribeDraftEditors = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const noDraftEdits = () => {
  return false;
};
export const registerDraftEditor = (editor: EditorDraft) => {
  editors.add(editor);
  changed();
  return () => {
    editors.delete(editor);
    changed();
  };
};
export const hasDraftEdits = () => {
  return [...editors].some((editor) => {
    return editor.dirty();
  });
};
export const flushDraftEditors = async () => {
  for (const editor of editors) if (editor.dirty()) await editor.flush();
};

export const captureDraftEditors = (reservedIds: readonly string[] = []) => {
  const recovered: JsonObject[] = [];
  const used = new Set(reservedIds);
  for (const editor of editors) {
    if (!editor.dirty() || !editor.capture) continue;
    const record = editor.capture();
    const prefix = "capture:" + crypto.randomUUID();
    let captureId = prefix,
      suffix = 0;
    while (used.has(captureId)) captureId = prefix + ":" + ++suffix;
    used.add(captureId);
    recovered.push({ ...record, captureId });
  }
  return recovered;
};

export const draftMessage = () => {
  for (const editor of editors)
    if (editor.dirty()) return editor.label ?? "Unsaved NPCDex draft";
  return "";
};

export const draftTicketIds = () => {
  return new Set(
    [...editors].flatMap((editor) => {
      return editor.dirty() ? (editor.ticketIds ?? []) : [];
    }),
  );
};

export const hasUnscopedDraftEdits = () => {
  return [...editors].some((editor) => {
    return editor.dirty() && !editor.ticketIds?.length;
  });
};
