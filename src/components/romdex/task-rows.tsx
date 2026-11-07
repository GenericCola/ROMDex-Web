import type { TaskItem, WorkspaceData } from "@/domain/types";
import { useLayoutEffect, type ReactNode } from "react";
import GroupDraftRow, { type GroupDraft } from "./group-draft-row";
import NewItem from "./new-item";
import { publishRowOrder } from "./task-row-order";
import { useRowWindow } from "./use-row-window";
type Entry =
  | { key: string; item: TaskItem }
  | { key: "group-draft" | "new-item"; item?: never };
const GROUP = { key: "group-draft" } as const,
  NEW = { key: "new-item" } as const;
// The header row is aria-rowindex 1, so entry n is n + 2.
const HEADER_ROWS = 2;
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
  render: (item: TaskItem, rowIndex: number) => ReactNode;
  group: GroupDraft | null;
  closeGroup: () => void;
}) => {
  const { newTask } = data;
  const ids = rows.map((item) => {
    return item.id;
  });
  const entries: Entry[] = [];
  if (group && !ids.includes(group.beforeId)) entries.push(GROUP);
  for (const item of rows) {
    if (group?.beforeId === item.id) entries.push(GROUP);
    entries.push({ key: item.id, item });
    if (newTask?.afterId === item.id) entries.push(NEW);
  }
  if (newTask && !ids.includes(newTask.afterId ?? "")) entries.push(NEW);
  // Drafts and the inline rename hold focus, so they render even when scrolled away.
  const rowWindow = useRowWindow(
    entries.map((entry) => {
      return entry.key;
    }),
    [GROUP.key, NEW.key, data.view.renameId ?? ""],
  );
  const publishVisibleOrder = () => {
    return publishRowOrder(ids);
  };
  useLayoutEffect(publishVisibleOrder);
  return (
    <tbody id="rows" {...rowWindow.body}>
      {rowWindow.segments.map((segment) => {
        if (segment.kind === "gap")
          return (
            <tr key={"gap-" + segment.from} className="row-gap" aria-hidden>
              <td colSpan={4} style={{ height: segment.height }} />
            </tr>
          );
        const entry = entries[segment.index];
        const rowIndex = segment.index + HEADER_ROWS;
        if (entry?.item) return render(entry.item, rowIndex);
        if (entry?.key === GROUP.key && group)
          return (
            <GroupDraftRow
              key={GROUP.key}
              draft={group}
              close={closeGroup}
              rowIndex={rowIndex}
            />
          );
        return (
          newTask && (
            <NewItem
              key={NEW.key}
              draft={newTask}
              data={data}
              items={items}
              rowIndex={rowIndex}
            />
          )
        );
      })}
    </tbody>
  );
};
export default TaskRows;
