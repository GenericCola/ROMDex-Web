import { indexTree } from "@/domain/accepted/core.mjs";
import {
  itemName,
  selectorExpansion,
  selectorSubtitle,
} from "@/domain/task-presentation";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { tw } from "@utils/tw";
import Image from "next/image";
import Lamp from "./lamp";
interface SelectorBranchProps {
  item: TaskItem;
  tree: ReturnType<typeof indexTree>;
  data: WorkspaceData;
  setSettingsId: (id: string) => void;
}
const SelectorBranch = ({
  item,
  tree,
  data,
  setSettingsId,
}: SelectorBranchProps) => {
  const renderChild = (child: TaskItem) => {
    return (
      <SelectorBranch
        key={child.id}
        item={child}
        tree={tree}
        data={data}
        setSettingsId={setSettingsId}
      />
    );
  };
  const depth = tree.depths.get(item.id) ?? 0;
  const children = tree.children.get(item.id) ?? [];
  const expanded = data.view.selectorExpanded.includes(item.id);
  const label = itemName(item);
  const expandable = depth < 3 && children.length > 0;
  const control = "selector-children-" + item.id;
  const select = () => {
    void workspaceStore.change((next) => {
      next.view.scope = item.id;
    });
  };
  const expand = () => {
    void workspaceStore.change((next) => {
      next.view.selectorExpanded = selectorExpansion(tree, item, expanded);
    });
  };
  return (
    <div key={item.id} className="selector-branch">
      <div
        className={tw(
          "selector",
          ["depth-0", "depth-1", "depth-2", "depth-3"][depth],
          data.view.scope === item.id && "selected",
        )}
      >
        <span className="selector-status">
          <Lamp color={tree.colors.get(item.id) ?? "grey"} />
        </span>
        <button
          className="selector-main"
          title={label}
          aria-current={data.view.scope === item.id ? "true" : "false"}
          onClick={select}
        >
          <span className="selector-label">
            <strong>{label}</strong>
            <small>{selectorSubtitle(depth, children.length)}</small>
          </span>
        </button>
        <button
          className="selector-cog"
          title="Tile Settings"
          aria-label={"Settings for " + label}
          onClick={() => {
            return setSettingsId(item.id);
          }}
        >
          <Image
            className="standard-settings-icon"
            src="/romdex/standard-settings-icon.svg"
            width={12}
            height={12}
            alt=""
          />
        </button>
        {expandable && (
          <button
            className="selector-expand"
            aria-label={(expanded ? "Collapse " : "Expand ") + label}
            aria-expanded={expanded}
            aria-controls={control}
            onClick={expand}
          >
            <span aria-hidden="true">▸</span>
          </button>
        )}
      </div>
      <div
        id={control}
        className={
          "selector-reveal" + (expanded && expandable ? " expanded" : "")
        }
        inert={!expanded || !expandable}
      >
        <div className="selector-reveal-body">
          <div className="selector-children">
            {expanded && expandable && children.map(renderChild)}
          </div>
        </div>
      </div>
    </div>
  );
};
export default SelectorBranch;
