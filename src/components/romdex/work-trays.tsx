import {
  escapeAction,
  tabAction,
} from "@/domain/accepted/workspace-keyboard.mjs";
import { clearWorkspaceFocus } from "@/domain/clear-workspace-focus";
import { flushDraftEditors } from "@/domain/editor-drafts";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { hasWorkspaceWork } from "@/domain/workspace-work";
import { useEffect, type ReactNode } from "react";
import { useWorkspaceDrag } from "./task-drag-context";
import { useSelectionWork } from "./use-selection-work";
import { useTrayLayout } from "./use-tray-layout";
import { useWorkSelection } from "./work-selection-context";
const interactive =
  'button,a,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="separator"]';
const WorkTrays = ({
  view,
  children,
}: {
  view: WorkspaceData["view"];
  children: ReactNode;
}) => {
  const { ref, style } = useTrayLayout(view);
  const drag = useWorkspaceDrag();
  const selection = useWorkSelection(),
    work = useSelectionWork();
  const focus = () => {
    ref.current?.focus({ preventScroll: true });
  };
  const keyDown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      !(event.target instanceof HTMLElement) ||
      !event.target.closest(".romdex-app")
    )
      return;
    const { target } = event;
    const current = workspaceStore.getSnapshot().data;
    const keys = {
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      isComposing: event.isComposing,
      modal: !!document.querySelector("dialog[open]"),
      busy:
        work.busy ||
        hasWorkspaceWork() ||
        !!target.closest(".romdex-app.pane-resizing") ||
        drag.pending(),
    };
    const escape = escapeAction({
      ...keys,
      hasSelection: !!(
        selection.selection.ids.length ||
        Boolean(current.view.selected) ||
        Boolean(current.newTask) ||
        Boolean(current.view.renameId) ||
        window.getSelection()?.isCollapsed === false
      ),
      fieldFocused: !!target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      ),
    });
    const tab = tabAction({
      ...keys,
      navigation:
        (target.matches(".row-check") && selection.selection.ids.length > 1) ||
        target.matches(".work-trays,.row-title,#work-tray") ||
        (!!target.closest(".task-row") && !target.closest(interactive)),
      selectedCount: selection.selection.ids.length,
    });
    if (tab === "group" && selection.group()) {
      event.preventDefault();
      return;
    }
    if (!escape && tab !== "cycle") return;
    event.preventDefault();
    work.run(async () => {
      await flushDraftEditors();
      await workspaceStore.change((next) => {
        if (escape === "clear") {
          clearWorkspaceFocus(next);
        } else if (escape === "toggle") {
          next.view.detailsMode =
            next.view.detailsMode === "collapsed" ? "default" : "collapsed";
          if (next.view.detailsMode === "default")
            next.view.automaticTrayHeight = true;
        } else {
          next.view.detailsMode =
            next.view.detailsMode === "default"
              ? "expanded"
              : next.view.detailsMode === "expanded"
                ? "collapsed"
                : "default";
          if (next.view.detailsMode === "default")
            next.view.automaticTrayHeight = true;
        }
      });
      if (escape === "clear") {
        selection.clear();
        window.getSelection()?.removeAllRanges();
      }
      await workspaceStore.flush();
      focus();
    });
  };
  useEffect(() => {
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("keydown", keyDown);
    };
  });
  return (
    <main
      ref={ref}
      tabIndex={-1}
      className={
        "work-trays" +
        (view.detailsMode === "collapsed"
          ? " details-collapsed"
          : view.detailsMode === "expanded"
            ? " details-full"
            : "")
      }
      style={style}
      aria-label="Work and Details Trays"
      onPointerDown={(event) => {
        if (!(event.target as Element).closest(interactive)) focus();
      }}
    >
      {children}
      {work.message && <p role="alert">{work.message}</p>}
    </main>
  );
};
export default WorkTrays;
