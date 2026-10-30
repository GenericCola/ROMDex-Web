import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import Image from "next/image";
import { useState } from "react";
import SelectorBranch from "./selector-branch";
import TileSettings from "./tile-settings";
interface SelectorProps {
  data: WorkspaceData;
  items: TaskItem[];
  add: (parentId: string | null) => void;
}
const Selectors = ({ data, items, add }: SelectorProps) => {
  const tree = indexTree(items, data.order);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const settingsItem = settingsId ? tree.byId.get(settingsId) : undefined;
  const all = () => {
    void workspaceStore.change((next) => {
      next.view.scope = null;
    });
  };
  const addEpic = () => {
    return add(null);
  };
  const render = (item: TaskItem) => {
    return (
      <SelectorBranch
        key={item.id}
        item={item}
        tree={tree}
        data={data}
        setSettingsId={setSettingsId}
      />
    );
  };

  return (
    <aside
      className="navigator suite-selector-tray"
      aria-label="Project Hierarchy"
    >
      <div className="pane-heading">
        <div>
          <span className="eyebrow">Pokémon / PMON</span>
        </div>
        <button className="icon-button" aria-label="Add Epic" onClick={addEpic}>
          +
        </button>
      </div>
      <button
        className={"all-items" + (!data.view.scope ? " active" : "")}
        onClick={all}
      >
        <Image
          src="/romdex/npcdex-pokeball.svg"
          width={16}
          height={16}
          alt=""
        />
        All Tasks <small>{items.length}</small>
      </button>
      <div className="selector-legend">EPIC → SAGA → STORY → VERSE</div>
      <nav id="selectors" aria-label="Epics, Sagas, Stories, and Verses">
        {(tree.children.get(null) ?? []).map(render)}
      </nav>
      {settingsItem && (
        <TileSettings
          key={settingsItem.id}
          item={settingsItem}
          depth={tree.depths.get(settingsItem.id) ?? 0}
          image={data.images?.[settingsItem.id] ?? null}
          close={() => {
            return setSettingsId(null);
          }}
        />
      )}
    </aside>
  );
};
export default Selectors;
