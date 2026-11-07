import { reportDeliveryFailure } from "@/cloud/delivery-failure";
import { incomingMessage, subscribeIncoming } from "@/cloud/incoming-status";
import {
  deliveryConnected,
  deliveryPaused,
  saveDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import type { WorkspaceSnapshot } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useSyncExternalStore } from "react";
import ConnectionIndicator from "./connection-indicator";
import DeviceBrand from "./device-brand";
import { saveIndicator, syncControl } from "./header-status";
import Lamp from "./lamp";
import { useSaveOverdue } from "./use-save-overdue";
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
  const sync = syncControl(
    deliveryConnected(),
    cloudData(state.data).autoSync,
    deliveryPaused(),
  );
  const overdue = useSaveOverdue(state, unsavedDrafts);
  const indicator = saveIndicator(state, unsavedDrafts, overdue);
  const saveReason = indicator.description;
  const save = () => {
    const done = (value: string) => {
      workspaceStore.setConnection(value);
    };
    const failed = (error: unknown) => {
      reportDeliveryFailure(error);
    };
    void saveDelivery().then(done, failed);
  };
  const toggleSync = () => {
    void workspaceStore.change((data) => {
      data.cloud = { ...cloudData(data), autoSync: !cloudData(data).autoSync };
    });
  };
  return (
    <>
      <header className="device-header" aria-label="Application Header">
        <DeviceBrand
          title={state.data.view.workspace === "romdex" ? "ROMDex" : "NPCDex"}
        />
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
                color={indicator.color}
                label={saveReason}
              />
            </button>
            <ConnectionIndicator
              connected={sync.connected}
              enabled={cloudData(state.data).autoSync}
              paused={deliveryPaused()}
              open={connect}
              detail={
                incoming ||
                (/^(Save stopped|Automatic delivery paused):/.test(
                  state.connection,
                )
                  ? state.connection
                  : "")
              }
            />
          </div>
        </div>
      </header>
    </>
  );
};
export default Header;
