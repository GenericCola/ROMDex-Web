import { indexTree, materialize, STATUS } from "@/domain/accepted/core.mjs";
import { ItemEditor } from "@/domain/accepted/item-editor-view.mjs";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { itemEditorHost } from "./item-editor-host";
import {
  editorItemSeed,
  escapeText,
  registerItemDraft,
} from "./item-editor-support";
import { itemEditorTemplate } from "./item-editor-template";
import SessionNotice from "./session-notice";
import { useOpenAttachments } from "./task-attachment-context";
const ItemEditDialog = ({
  item,
  close,
}: {
  item: TaskItem;
  close: () => void;
}) => {
  const openAttachments = useOpenAttachments();
  const anchorRef = useRef<HTMLSpanElement>(null),
    closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  const [notice, setNotice] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = anchorRef.current?.closest(".romdex-app");
    if (!root) return;
    const template = document.createElement("template");
    template.innerHTML = itemEditorTemplate;
    const dialog = template.content.firstElementChild as HTMLDialogElement;
    const surface = document.createElement("div");
    dialog.prepend(surface);
    root.append(dialog);
    setNotice(surface);
    const items = () => {
      const { data } = workspaceStore.getSnapshot();
      return materialize(data.remote, data.operations);
    };
    const editor = new ItemEditor({
      ws: itemEditorHost(item),
      esc: escapeText,
      onSaved: () => {
        closeRef.current();
      },
    });
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-close]")
      .forEach((button) => {
        button.onclick = () => {
          if (!editor.saving) dialog.close();
        };
      });
    const attachments =
      dialog.querySelector<HTMLButtonElement>("#edit-attachments");
    if (attachments)
      attachments.onclick = () => {
        if (editor.hasUnsavedChanges()) {
          const error = dialog.querySelector("#edit-error");
          if (error)
            error.textContent =
              "Save or Cancel Item Changes Before Opening Attachments.";
          return;
        }
        dialog.close();
        openAttachments(item.id);
      };
    const closed = () => {
      closeRef.current();
    };
    dialog.addEventListener("close", closed);
    const tree = indexTree(items());
    void editor.open(editorItemSeed(item), {
      displayStatus: STATUS[tree.colors.get(item.id) ?? "grey"],
      parent: !!tree.children.get(item.id)?.length,
    });
    const unregister = registerItemDraft(dialog, item.id);
    return () => {
      unregister();
      editor.session = null;
      dialog.removeEventListener("close", closed);
      dialog.remove();
    };
  }, [item, openAttachments]);
  return (
    <>
      <span ref={anchorRef} />
      {notice && createPortal(<SessionNotice />, notice)}
    </>
  );
};
export default ItemEditDialog;
