import { itemName, taskTier } from "@/domain/task-presentation";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { subtreeIds, workspaceTree } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
const WorkHeading = ({
  items,
  data,
}: {
  items: TaskItem[];
  data: WorkspaceData;
}) => {
  const tree = workspaceTree(items, data.order);
  const { scope } = data.view;
  const selected = scope ? tree.byId.get(scope) : undefined;
  const scopeIds = scope
    ? subtreeIds(tree, scope)
    : items.map((item) => {
        return item.id;
      });
  const complete = scopeIds.filter((id) => {
    return tree.colors.get(id) === "green";
  }).length;
  const path: TaskItem[] = [];
  let ancestor = selected;
  while (
    ancestor &&
    !path.some((item) => {
      return item.id === ancestor?.id;
    })
  ) {
    path.unshift(ancestor);
    ancestor = ancestor.parentId ? tree.byId.get(ancestor.parentId) : undefined;
  }
  const chooseScope = (id: string | null) => {
    void workspaceStore.change((next) => {
      next.view.scope = id;
    });
  };
  return (
    <>
      <nav className="breadcrumbs" aria-label="Task hierarchy">
        <button
          onClick={() => {
            return chooseScope(null);
          }}
        >
          Pokémon
        </button>
        {path.map((item) => {
          return (
            <span key={item.id}>
              {" "}
              /{" "}
              <button
                onClick={() => {
                  return chooseScope(item.id);
                }}
              >
                {itemName(item)}
              </button>
            </span>
          );
        })}
      </nav>
      <div className="work-title-row">
        <div>
          <h2>{selected ? itemName(selected) : "All Tasks"}</h2>
          <p className="muted">
            {scopeIds.length} {scopeIds.length === 1 ? "Item" : "Items"} ·{" "}
            {complete} Complete ·{" "}
            {selected
              ? taskTier(tree.depths.get(selected.id) ?? 0)
              : "All Epics"}
          </p>
        </div>
      </div>
    </>
  );
};
export default WorkHeading;
