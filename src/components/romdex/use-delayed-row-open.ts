import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef } from "react";
import { createRowOpenQueue, mayOpenDelayedRow } from "./row-open-queue";
const queue = createRowOpenQueue({
  after: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => {
      clearTimeout(timer);
    };
  },
  interrupt: (cancel, commit) => {
    // Pressing Save keeps the row the user just clicked: select it first, so
    // a Save within 220 ms does not drop the selection (PMON-639).
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("#save"))
        commit();
      else cancel();
    };
    document.addEventListener("keydown", cancel, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", cancel, true);
      document.removeEventListener("pointerdown", pointer, true);
    };
  },
});
const context = () => {
  const { data } = workspaceStore.getSnapshot();
  return {
    scope: data.view.scope,
    workspace: data.view.workspace,
    epoch: workspaceStore.workspaceEpoch(),
    editing:
      !!data.view.renameId ||
      !!data.newTask ||
      !!document.querySelector(".draft-row"),
    modal: !!document.querySelector("dialog[open]"),
  };
};
export const useDelayedRowOpen = (open: () => void) => {
  const ownerRef = useRef(Symbol("row-open"));
  useEffect(() => {
    const id = ownerRef.current;
    return () => {
      queue.cancel(id);
    };
  }, []);
  return {
    cancel: () => {
      queue.cancel();
    },
    schedule: () => {
      const before = context();
      queue.schedule(
        ownerRef.current,
        () => {
          return mayOpenDelayedRow(before, context());
        },
        open,
      );
    },
  };
};
