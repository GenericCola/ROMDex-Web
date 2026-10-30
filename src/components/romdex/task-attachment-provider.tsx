import { materialize } from "@/domain/accepted/core.mjs";
import { workspaceStore } from "@/domain/workspace-store";
import {
  useCallback,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { TaskAttachmentContext } from "./task-attachment-context";
import TaskAttachmentDialog from "./task-attachment-dialog";
const TaskAttachmentProvider = ({ children }: PropsWithChildren) => {
  const [id, setId] = useState<string | null>(null);
  const state = useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getSnapshot,
    workspaceStore.getSnapshot,
  );
  const open = useCallback((target: string) => {
    setId(target);
  }, []);
  const close = () => {
    setId(null);
  };
  const item = materialize(state.data.remote, state.data.operations).find(
    (entry) => {
      return entry.id === id;
    },
  );
  return (
    <TaskAttachmentContext value={open}>
      {children}
      {item && (
        <TaskAttachmentDialog
          key={item.id}
          item={item}
          data={state.data}
          close={close}
        />
      )}
    </TaskAttachmentContext>
  );
};
export default TaskAttachmentProvider;
