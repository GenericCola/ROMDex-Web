import { flushDraftEditors } from "@/domain/editor-drafts";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { nodes, nodeText } from "@/npcdex/model";
import { emptyNpcdexTarget } from "@/npcdex/position";
const NpcdexSidebar = ({ data }: { data: WorkspaceData }) => {
  const select = async (town: string, area = "") => {
    try {
      await flushDraftEditors();
      await workspaceStore.change((next) => {
        next.view.npcdex = {
          target: { ...emptyNpcdexTarget(), town, area },
          gender: next.view.npcdex?.gender ?? "male",
          stage: next.view.npcdex?.stage ?? "",
        };
      });
    } catch (error) {
      workspaceStore.setConnection(
        error instanceof Error
          ? error.message
          : "Save the draft before changing maps.",
      );
    }
  };
  return (
    <aside className="navigator suite-tray" aria-label="NPCDex Maps">
      <div className="pane-heading">
        <span className="eyebrow">NPCDex / Maps</span>
      </div>
      <nav aria-label="Maps and areas">
        {nodes(data.npcdex, "towns").map((town) => {
          const id = nodeText(town, "id"),
            selected = data.view.npcdex?.target.town === id;
          return (
            <div key={id}>
              <div
                className={"port-selector-row" + (selected ? " active" : "")}
              >
                <button
                  onClick={() => {
                    void select(id);
                  }}
                >
                  {nodeText(town, "name")}
                </button>
              </div>
              {selected &&
                nodes(town, "areas").map((area) => {
                  return (
                    <div
                      className="port-selector-row"
                      key={nodeText(area, "id")}
                    >
                      <button
                        onClick={() => {
                          void select(id, nodeText(area, "id"));
                        }}
                      >
                        {nodeText(area, "name")}
                      </button>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
export default NpcdexSidebar;
