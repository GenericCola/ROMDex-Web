import type { JsonObject } from "./json";
interface EditorDraft {
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

export const captureDraftEditors = () => {
  const recovered: JsonObject[] = [];
  for (const editor of editors)
    if (editor.dirty() && editor.capture) recovered.push(editor.capture());
  return recovered;
};
