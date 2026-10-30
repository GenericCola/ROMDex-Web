import type { TaskItem, WorkspaceData } from "@/domain/types";
import { Fragment, type ReactNode } from "react";
import GroupDraftRow, { type GroupDraft } from "./group-draft-row";
import NewItem from "./new-item";
const TaskRows = ({
  rows,
  data,
  items,
  render,
  group,
  closeGroup,
}: {
  rows: TaskItem[];
  data: WorkspaceData;
  items: TaskItem[];
  render: (item: TaskItem) => ReactNode;
  group: GroupDraft | null;
  closeGroup: () => void;
}) => {
  return (
    <tbody>
      {group &&
        !rows.some((item) => {
          return item.id === group.beforeId;
        }) && <GroupDraftRow draft={group} close={closeGroup} />}
      {rows.map((item) => {
        return (
          <Fragment key={item.id}>
            {group?.beforeId === item.id && (
              <GroupDraftRow draft={group} close={closeGroup} />
            )}
            {render(item)}
            {data.newTask?.afterId === item.id && (
              <NewItem draft={data.newTask} data={data} items={items} />
            )}
          </Fragment>
        );
      })}
      {data.newTask &&
        !rows.some((item) => {
          return item.id === data.newTask?.afterId;
        }) && <NewItem draft={data.newTask} data={data} items={items} />}
    </tbody>
  );
};
export default TaskRows;
