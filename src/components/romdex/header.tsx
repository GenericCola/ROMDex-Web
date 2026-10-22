import { deliveryConnected, saveDelivery } from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import type { WorkspaceSnapshot } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import Lamp from "./lamp";
import WorkspaceMenu from "./workspace-menu";
interface HeaderProps {
  state: WorkspaceSnapshot;
  connect: () => void;
}
const Header = ({ state, connect }: HeaderProps) => {
  const [message, setMessage] = useState("");
  const save = () => {
    setMessage("");
    const done = (value: string) => {
      return setMessage(value);
    };
    const failed = (error: unknown) => {
      return setMessage(
        error instanceof Error ? error.message : "Cloud delivery failed",
      );
    };
    void saveDelivery().then(done, failed);
  };
  const status = state.delivering
    ? ""
    : state.connection.startsWith("Automatic delivery paused")
      ? state.connection
      : message;
  const toggleSync = () => {
    void workspaceStore.change((data) => {
      data.cloud = { ...cloudData(data), autoSync: !cloudData(data).autoSync };
    });
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
          <WorkspaceMenu workspace={state.data.view.workspace} />
          <button
            className="auto-sync-toggle"
            {...{ autoComplete: "off" }}
            role="switch"
            aria-label="Auto-Sync Data"
            aria-checked={cloudData(state.data).autoSync}
            disabled={!deliveryConnected()}
            onClick={toggleSync}
            title="Deliver supported queued changes every 10 seconds while connected"
          >
            Auto-Sync Data{" "}
            <span className="toggle-value">
              {cloudData(state.data).autoSync ? "On" : "Off"}
            </span>
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
                      : state.data.operations.length ||
                          cloudData(state.data).rollupPending
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
      {status && (
        <p className="port-notice" role="status">
          {status}
        </p>
      )}
    </>
  );
};
export default Header;
