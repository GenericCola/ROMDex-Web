import { registerDraftEditor } from "@/domain/editor-drafts";
import type { TaskItem } from "@/domain/types";
export const editorItemSeed = (item: TaskItem): TaskItem => {
  if (item.assignee !== undefined || !item.assignees?.length) return item;
  return {
    ...item,
    assignee:
      item.assignees.length === 1
        ? item.assignees[0]!.id
        : item.assignees.map((person) => {
            return person.id;
          }),
  };
};
export const unavailable =
  "This field needs its web delivery adapter. Its existing value is preserved.";
export const configuration = {
  assignee: { ready: false, message: unavailable, options: [] },
  dueDate: { ready: false, message: unavailable },
  tags: { ready: false, message: unavailable, options: [] },
  custom: [],
};
export const escapeText = (value: unknown) => {
  return String(
    typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? value
      : "",
  ).replace(/[&<>"']/g, (character) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        character
      ] ?? character
    );
  });
};
export const registerItemDraft = (
  dialog: HTMLDialogElement,
  issueId: string,
) => {
  return registerDraftEditor({
    label: "Save or cancel the item editor before continuing.",
    dirty: () => {
      return dialog.open;
    },
    flush: () => {
      if (dialog.open)
        throw Error(
          "Save or cancel the item editor before switching accounts or updating.",
        );
      return Promise.resolve();
    },
    capture: () => {
      return {
        kind: "item-editor",
        issueId,
        fields: [
          ...dialog.querySelectorAll<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >("input,textarea,select"),
        ].map((control) => {
          return { id: control.id, value: control.value };
        }),
      };
    },
  });
};
