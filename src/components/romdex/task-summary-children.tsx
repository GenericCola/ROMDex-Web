import { indexTree } from "@/domain/accepted/core.mjs";
import { beginInlineTask } from "@/domain/task-inline";
import { itemName } from "@/domain/task-presentation";
import type { TaskItem } from "@/domain/types";
import { useDetailNavigation } from "./detail-navigation-context";
import Lamp from "./lamp";
import { useInlineAction } from "./use-inline-action";
const TaskSummaryChildren = ({
  item,
  tree,
}: {
  item: TaskItem;
  tree: ReturnType<typeof indexTree>;
}) => {
  const children = tree.children.get(item.id) ?? [];
  const inline = useInlineAction(),
    navigation = useDetailNavigation();
  const add = () => {
    inline.run((data) => {
      beginInlineTask(data, item.id);
      data.view.detailsMode = "default";
    });
  };
  return (
    <div id="detail-children">
      {children.length ? (
        <>
          <div className="detail-subhead">
            <h3>Children · {children.length}</h3>
            <button
              className="icon-button"
              aria-label="Add Child"
              onClick={add}
            >
              +
            </button>
          </div>
          {children.map((child) => {
            return (
              <button
                key={child.id}
                className="detail-child"
                onClick={() => {
                  navigation.open(child.id, true);
                }}
              >
                <Lamp color={tree.colors.get(child.id) ?? "grey"} />
                <span>{itemName(child)}</span>
              </button>
            );
          })}
        </>
      ) : (
        <button className="text-button" onClick={add}>
          + Add Subtask
        </button>
      )}
      {inline.error && <p role="alert">{inline.error}</p>}
    </div>
  );
};
export default TaskSummaryChildren;
