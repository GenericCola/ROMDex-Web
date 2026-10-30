import type { ReactNode } from "react";
import DetailNavigationProvider from "./detail-navigation-provider";
import TaskAttachmentProvider from "./task-attachment-provider";
import { TaskDragContext } from "./task-drag-context";
import TaskFileDrop from "./task-file-drop";
import { useTaskDrag } from "./use-task-drag";
import { useWorkSelection } from "./work-selection-context";
const DeviceBody = ({
  children,
  inert,
  enabled,
}: {
  children: ReactNode;
  inert: boolean;
  enabled: boolean;
}) => {
  const selection = useWorkSelection();
  const drag = useTaskDrag(selection.selection.ids, selection.clear);
  return (
    <TaskDragContext value={drag}>
      <DetailNavigationProvider>
        <div
          className="device-body"
          inert={inert}
          {...(enabled ? drag.handlers : {})}
        >
          <TaskAttachmentProvider>{children}</TaskAttachmentProvider>
          <TaskFileDrop enabled={enabled} />
        </div>
      </DetailNavigationProvider>
    </TaskDragContext>
  );
};
export default DeviceBody;
