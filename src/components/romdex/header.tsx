import type { WorkspaceSnapshot } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import Lamp from "./lamp";
interface HeaderProps {
  state: WorkspaceSnapshot;
  connect: () => void;
}
const Header = ({ state, connect }: HeaderProps) => {
  const [menu, setMenu] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = () => {
    return setMenu(!menu);
  };
  const close = () => {
    return setMenu(false);
  };
  const save = () => {
    const done = () => {
      return setMessage(
        "Saved in this browser. YouTrack delivery is not enabled yet.",
      );
    };
    const failed = (error: unknown) => {
      return setMessage(
        error instanceof Error ? error.message : "Local save failed.",
      );
    };
    void workspaceStore.flush().then(done, failed);
  };
  const changeWorkspace = (workspace: "romdex" | "npcdex") => {
    void workspaceStore.change((data) => {
      data.view.workspace = workspace;
    });
    close();
  };
  const openRomdex = () => {
    return changeWorkspace("romdex");
  };
  const openNpcdex = () => {
    return changeWorkspace("npcdex");
  };
  return (
    <>
      <header className="device-header" aria-label="Application Header">
        <div className="brand">
          <div className="lens" aria-hidden="true" />
          <h1>
            <span className="brand-title">
              {state.data.view.workspace === "romdex" ? "ROMDex" : "NPCDex"}
            </span>
          </h1>
          <div className="lamps" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="header-actions">
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
              <div
                className="suite-popover"
                role="menu"
                aria-label="Workspaces"
              >
                <button
                  role="menuitemradio"
                  aria-checked={state.data.view.workspace === "romdex"}
                  onClick={openRomdex}
                >
                  ROMDex
                </button>
                <button
                  role="menuitemradio"
                  aria-checked={state.data.view.workspace === "npcdex"}
                  onClick={openNpcdex}
                >
                  NPCDex
                </button>
              </div>
            )}
          </div>
          <button
            className="auto-sync-toggle"
            role="switch"
            aria-label="Auto-Sync Data"
            aria-checked={false}
            disabled
            title="Cloud delivery is not enabled in this port yet"
          >
            Auto-Sync Data <span className="toggle-value">Off</span>
          </button>
          <div className="save-controls">
            <button
              id="save"
              className="save"
              onClick={save}
              disabled={!state.ready}
            >
              Save Changes{" "}
              <Lamp
                color={
                  state.error
                    ? "red"
                    : state.pendingWrites
                      ? "yellow"
                      : state.data.operations.length
                        ? "red"
                        : "green"
                }
              />
            </button>
            <button
              id="connect-open"
              className="header-connection"
              aria-label="Connection Details"
              title="Connection Details"
              onClick={connect}
            >
              <span className="connection-status">
                <Lamp
                  color={
                    state.connection === "Not connected" ? "blue" : "yellow"
                  }
                />
              </span>
            </button>
          </div>
        </div>
      </header>
      {message && (
        <p className="port-notice" role="status">
          {message}
        </p>
      )}
    </>
  );
};
export default Header;
