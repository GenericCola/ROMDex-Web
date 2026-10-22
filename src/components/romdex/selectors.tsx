import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import Image from "next/image";
import Lamp from "./lamp";
interface SelectorProps {
  data: WorkspaceData;
  items: TaskItem[];
  add: (parentId: string | null) => void;
}
const Selectors = ({ data, items, add }: SelectorProps) => {
  const tree = indexTree(items, data.order);
  const all = () => {
    void workspaceStore.change((next) => {
      next.view.scope = null;
    });
  };
  const addEpic = () => {
    return add(null);
  };
  const render = (item: TaskItem): React.ReactNode => {
    const depth = tree.depths.get(item.id) ?? 0;
    const children = tree.children.get(item.id) ?? [];
    const expanded = data.view.selectorExpanded.includes(item.id);
    const select = () => {
      void workspaceStore.change((next) => {
        next.view.scope = item.id;
      });
    };
    const expand = () => {
      void workspaceStore.change((next) => {
        if (expanded)
          next.view.selectorExpanded = next.view.selectorExpanded.filter(
            (id) => {
              return id !== item.id;
            },
          );
        else {
          next.view.selectorExpanded = next.view.selectorExpanded.filter(
            (id) => {
              return (tree.depths.get(id) ?? 0) < depth;
            },
          );
          next.view.selectorExpanded.push(item.id);
        }
      });
    };
    return (
      <div key={item.id}>
        <div
          className={
            "port-selector-row" + (data.view.scope === item.id ? " active" : "")
          }
          style={{ paddingLeft: depth * 10 }}
        >
          {depth < 3 && children.length > 0 ? (
            <button
              className="port-selector-toggle"
              aria-label={(expanded ? "Collapse " : "Expand ") + item.summary}
              aria-expanded={expanded}
              onClick={expand}
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span aria-hidden="true">·</span>
          )}
          <button title={item.summary} onClick={select}>
            <Lamp color={tree.colors.get(item.id) ?? "grey"} /> {item.summary}
          </button>
        </div>
        {expanded && depth < 3 && children.map(render)}
      </div>
    );
  };
  return (
    <aside className="navigator suite-tray" aria-label="Project Hierarchy">
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
    </aside>
  );
};
export default Selectors;
