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
  interrupt: (cancel) => {
    document.addEventListener("keydown", cancel, true);
    document.addEventListener("pointerdown", cancel, true);
    return () => {
      document.removeEventListener("keydown", cancel, true);
      document.removeEventListener("pointerdown", cancel, true);
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
