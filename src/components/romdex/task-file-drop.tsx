import { FileDropTarget } from "@/domain/accepted/file-drop.mjs";
import { taskEditingLocked } from "@/domain/task-edit-lock";
import { findWorkspaceItem } from "@/domain/workspace-item";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef } from "react";
import { stageTaskFiles } from "./stage-task-files";
import { useWorkspaceDrag } from "./task-drag-context";
import { useAttachmentWork } from "./use-attachment-work";
const TaskFileDrop = ({ enabled }: { enabled: boolean }) => {
  const anchorRef = useRef<HTMLSpanElement>(null),
    work = useAttachmentWork(),
    drag = useWorkspaceDrag();
  const currentRef = useRef({ work, drag });
  useEffect(() => {
    currentRef.current = { work, drag };
  }, [work, drag]);
  const { message, busy, setMessage } = work;
  useEffect(() => {
    if (!message || busy) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [message, busy, setMessage]);
  useEffect(() => {
    const root = anchorRef.current?.closest(".romdex-app");
    if (!enabled || !root) return;
    const target = new FileDropTarget({
      doc: document,
      item: (id) => {
        if (taskEditingLocked(id)) return undefined;
        const { data } = workspaceStore.getSnapshot();
        return findWorkspaceItem(data, id);
      },
      attach: async (id, files) => {
        let staged: string[] = [];
        const promise = currentRef.current.work.runAwaitable(async () => {
          staged = await stageTaskFiles(id, files);
        });
        if (!promise)
          throw Error(
            "Files are already being staged. Wait before dropping more.",
          );
        await promise;
        return staged;
      },
      suppressClick: () => {
        currentRef.current.drag.suppressClick();
      },
      notify: (message) => {
        currentRef.current.work.setMessage(message);
      },
      internalDrag: () => {
        const state = workspaceStore.getSnapshot();
        return (
          currentRef.current.drag.pending() ||
          state.updating ||
          !!document.querySelector("dialog[open]")
        );
      },
    });
    root.append(target.feedback);
    return () => {
      target.dispose();
    };
  }, [enabled]);
  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {enabled && work.message && (
        <p id="toast" role="status">
          {work.message}
        </p>
      )}
    </>
  );
};
export default TaskFileDrop;
