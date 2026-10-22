import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
const WorkspaceMenu = ({ workspace }: { workspace: "romdex" | "npcdex" }) => {
  const [menu, setMenu] = useState(false);
  const toggle = () => {
    return setMenu(!menu);
  };
  const open = (id: "romdex" | "npcdex") => {
    void workspaceStore.change((data) => {
      data.view.workspace = id;
    });
    setMenu(false);
  };
  const romdex = () => {
      return open("romdex");
    },
    npcdex = () => {
      return open("npcdex");
    };
  return (
    <div className="suite-menu-anchor">
      <button
        id="workspace-switcher"
        className="workspace-switcher"
        aria-label="Switch Workspace"
        title="Switch Workspace"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={toggle}
      />
      {menu && (
        <div className="suite-popover" role="menu" aria-label="Workspaces">
          <button
            role="menuitemradio"
            aria-checked={workspace === "romdex"}
            onClick={romdex}
          >
            ROMDex
          </button>
          <button
            role="menuitemradio"
            aria-checked={workspace === "npcdex"}
            onClick={npcdex}
          >
            NPCDex
          </button>
        </div>
      )}
    </div>
  );
};
export default WorkspaceMenu;
