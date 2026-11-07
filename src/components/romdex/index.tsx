"use client";
import { WorkSelectionProvider } from "./work-selection-provider";

import { recoveryMode } from "@/auth/recovery-mode";
import {
  hasDraftEdits,
  noDraftEdits,
  subscribeDraftEditors,
} from "@/domain/editor-drafts";
import { beginInlineTask } from "@/domain/task-inline";
import { workspaceItems } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
import { usePwa } from "@components/pwa-controls/use-pwa";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Details from "./details";
import DeviceBody from "./device-body";
import Divider from "./divider";
import Header from "./header";
import {
  LazyConnection,
  LazyMigration,
  LazyNpcdex,
  LazyNpcdexSidebar,
} from "./lazy-views";
import LocalSaveRecovery from "./local-save-recovery";
import SaveFeedback from "./save-feedback";
import Selectors from "./selectors";
import StoreNotice from "./store-notice";
import { useInlineAction } from "./use-inline-action";
import { useStableCallback } from "./use-stable-callback";
import { useWorkspace } from "./use-workspace";
import WorkTable from "./work-table";
import WorkTrays from "./work-trays";
import WorkspaceSkeleton from "./workspace-skeleton";
import WorkspaceStatus from "./workspace-status";
import WorkspaceToolViews from "./workspace-tool-views";
import {
  WorkspaceToolsContext,
  type WorkspaceTool,
} from "./workspace-tools-context";
const Romdex = ({ account }: { account?: ReactNode }) => {
  const state = useWorkspace();
  const inline = useInlineAction();
  const draftEdits = useSyncExternalStore(
    subscribeDraftEditors,
    hasDraftEdits,
    noDraftEdits,
  );
  const [connection, setConnection] = useState(false);
  const [migration, setMigration] = useState(false);
  const [tool, setTool] = useState<WorkspaceTool | null>(null);
  const update = usePwa(workspaceStore.prepareUpdate);
  const chooseTool = (next: WorkspaceTool) => {
    setTool(next);
    if (next === "updates") void update.checkForUpdates();
  };
  const closeTool = () => {
    setTool(null);
  };
  const openMigration = () => {
    setMigration(true);
  };
  const closeMigration = () => {
    setMigration(false);
  };
  const items = workspaceItems(state.data);
  const openConnection = () => {
    return setConnection(true);
  };
  const closeConnection = () => {
    return setConnection(false);
  };
  const add = useStableCallback((parentId: string | null) => {
    inline.run((data) => {
      beginInlineTask(data, parentId);
    });
  });
  const { view } = state.data;
  return (
    <WorkspaceToolsContext value={chooseTool}>
      <WorkSelectionProvider>
        <div className="romdex-app" inert={state.updating}>
          <Header
            state={state}
            connect={openConnection}
            unsavedDrafts={draftEdits}
          />
          {recoveryMode() && (
            <WorkspaceStatus
              state={state}
              drafts={draftEdits}
              openMigration={openMigration}
              openRdx={() => {
                return setTool("import");
              }}
            />
          )}
          <SaveFeedback state={state} review={openConnection} />
          <StoreNotice review={openConnection} />
          {inline.error && (
            <p className="port-recovery" role="alert">
              {inline.error}
            </p>
          )}
          {state.error && <LocalSaveRecovery state={state} />}
          {!state.ready && !state.error && <WorkspaceSkeleton />}
          {state.ready && (
            <DeviceBody enabled={view.workspace === "romdex"} inert={false}>
              {view.workspace === "romdex" ? (
                <Selectors data={state.data} items={items} add={add} />
              ) : (
                <LazyNpcdexSidebar data={state.data} />
              )}
              {view.workspace === "romdex" ? (
                <WorkTrays view={view}>
                  <WorkTable data={state.data} items={items} add={add} />
                  <Divider view={view} />
                  <Details data={state.data} items={items} />
                </WorkTrays>
              ) : (
                <LazyNpcdex data={state.data} />
              )}
            </DeviceBody>
          )}
          {connection && (
            <LazyConnection close={closeConnection} account={account} />
          )}
          {migration && <LazyMigration close={closeMigration} />}
          {tool && (
            <WorkspaceToolViews
              tool={tool}
              data={state.data}
              update={update}
              close={closeTool}
            />
          )}
        </div>
      </WorkSelectionProvider>
    </WorkspaceToolsContext>
  );
};
export default Romdex;
