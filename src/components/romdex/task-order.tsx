import { moveSibling } from "@/domain/task-layout";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
const TaskOrder = ({ item }: { item: TaskItem }) => {
  const move = (direction: -1 | 1) => {
    void workspaceStore.change((data) => {
      moveSibling(data, item.id, direction);
    });
  };
  return (
    <>
      <button
        aria-label={"Move " + item.summary + " up"}
        onClick={() => {
          move(-1);
        }}
      >
        ↑
      </button>
      <button
        aria-label={"Move " + item.summary + " down"}
        onClick={() => {
          move(1);
        }}
      >
        ↓
      </button>
    </>
  );
};
export default TaskOrder;
