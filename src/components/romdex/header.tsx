import { incomingMessage, subscribeIncoming } from "@/cloud/incoming-status";
import {
  deliveryConnected,
  deliveryPaused,
  saveDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import type { WorkspaceSnapshot } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState, useSyncExternalStore } from "react";
import ConnectionIndicator from "./connection-indicator";
import { deliveryMessage, saveExplanation, syncControl } from "./header-status";
import Lamp from "./lamp";
import WorkspaceMenu from "./workspace-menu";
interface HeaderProps {
  state: WorkspaceSnapshot;
  connect: () => void;
  unsavedDrafts?: boolean;
}
const Header = ({ state, connect, unsavedDrafts = false }: HeaderProps) => {
  const incoming = useSyncExternalStore(
    subscribeIncoming,
    incomingMessage,
    () => {
      return "";
    },
  );
  const [message, setMessage] = useState<{
    text: string;
    connection: string;
  } | null>(null);
  const sync = syncControl(
    deliveryConnected(),
    cloudData(state.data).autoSync,
    deliveryPaused(),
  );
  const saveReason = saveExplanation(state, unsavedDrafts);
  const save = () => {
    setMessage(null);
    const done = (value: string) => {
      return setMessage({
        text: value,
        connection: workspaceStore.getSnapshot().connection,
      });
    };
    const failed = (error: unknown) => {
      return setMessage({
        text: error instanceof Error ? error.message : "Cloud delivery failed",
        connection: workspaceStore.getSnapshot().connection,
      });
    };
    void saveDelivery().then(done, failed);
  };
  const status = deliveryMessage(state, message);
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
            role={sync.role}
            aria-label={sync.label}
            aria-checked={sync.checked}
            onClick={sync.connected ? toggleSync : connect}
            title={sync.description}
          >
            Auto-Sync Data <span className="toggle-value">{sync.value}</span>
          </button>
          <div className="save-controls">
            <button
              id="save"
              className="save"
              onClick={save}
              disabled={!state.ready}
              title={saveReason}
              aria-label={`Save Changes. ${saveReason}`}
            >
              Save Changes{" "}
              <Lamp
                className="save-light"
                color={
                  state.error
                    ? "red"
                    : state.pendingWrites
                      ? "yellow"
                      : unsavedDrafts ||
                          state.data.operations.length ||
                          cloudData(state.data).rollupPending
                        ? "red"
                        : "green"
                }
              />
            </button>
            <ConnectionIndicator
              connected={sync.connected}
              enabled={cloudData(state.data).autoSync}
              paused={deliveryPaused()}
              open={connect}
            />
          </div>
        </div>
      </header>
      {incoming && (
        <p className="port-notice" role="status">
          {incoming}
        </p>
      )}
      {deliveryPaused() && (
        <div className="port-notice" role="status">
          <span>
            Auto-Sync is paused. Your pending changes are kept in this
            browser.{" "}
          </span>
          <button onClick={connect}>Review sync problems</button>
        </div>
      )}
      {status && (
        <p className="port-notice" role="status">
          {status}
        </p>
      )}
    </>
  );
};
export default Header;
