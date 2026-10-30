"use client";
import { needsDeliveryReview, reviewNotice } from "@/domain/review-browsing";
import { WorkSelectionProvider } from "./work-selection-provider";

import { materialize } from "@/domain/accepted/core.mjs";
import {
  hasDraftEdits,
  noDraftEdits,
  subscribeDraftEditors,
} from "@/domain/editor-drafts";
import { beginInlineTask } from "@/domain/task-inline";
import { workspaceStore } from "@/domain/workspace-store";
import Npcdex from "@components/npcdex";
import NpcdexSidebar from "@components/npcdex/sidebar";
import PwaControls from "@components/pwa-controls";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Connection from "./connection";
import Details from "./details";
import DeviceBody from "./device-body";
import Divider from "./divider";
import Header from "./header";
import Migration from "./migration";
import RdxLibrary from "./rdx-library";
import Selectors from "./selectors";
import { useInlineAction } from "./use-inline-action";
import { useWorkspace } from "./use-workspace";
import WorkTable from "./work-table";
import WorkTrays from "./work-trays";
import WorkspaceStatus from "./workspace-status";
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
  const [rdx, setRdx] = useState(false);
  const openMigration = () => {
    setMigration(true);
  };
  const closeMigration = () => {
    setMigration(false);
  };
  const items = materialize(state.data.remote, state.data.operations);
  const openConnection = () => {
    return setConnection(true);
  };
  const closeConnection = () => {
    return setConnection(false);
  };
  const add = (parentId: string | null) => {
    inline.run((data) => {
      beginInlineTask(data, parentId);
    });
  };
  const { view } = state.data;
  const mode = view.detailsMode;
  return (
    <WorkSelectionProvider>
      <div className="romdex-app" inert={state.updating || state.delivering}>
        <Header
          state={state}
          connect={openConnection}
          unsavedDrafts={draftEdits}
          tools={
            <>
              {account}
              <WorkspaceStatus
                state={state}
                drafts={draftEdits}
                openMigration={openMigration}
                openRdx={() => {
                  setRdx(true);
                }}
              />
              <PwaControls beforeUpdate={workspaceStore.prepareUpdate} />
            </>
          }
        />
        {inline.error && (
          <p className="port-recovery" role="alert">
            {inline.error}
          </p>
        )}
        {state.error && (
          <p className="port-recovery" role="alert">
            {state.error}
          </p>
        )}
        {needsDeliveryReview(state.data) && (
          <p className="port-notice" role="status">
            {reviewNotice(state.data)} Browsing is available; task edits are
            paused.
            <button onClick={openConnection}>Review pending changes</button>
          </p>
        )}
        {state.ready && (
          <DeviceBody
            enabled={view.workspace === "romdex"}
            inert={!!state.error}
          >
            {view.workspace === "romdex" ? (
              <Selectors data={state.data} items={items} add={add} />
            ) : (
              <NpcdexSidebar data={state.data} />
            )}
            {view.workspace === "romdex" ? (
              <WorkTrays view={view}>
                {mode !== "expanded" && (
                  <WorkTable data={state.data} items={items} add={add} />
                )}
                <Divider view={view} />
                {mode !== "collapsed" && (
                  <Details data={state.data} items={items} />
                )}
              </WorkTrays>
            ) : (
              <Npcdex data={state.data} />
            )}
          </DeviceBody>
        )}
        {connection && <Connection close={closeConnection} />}
        {migration && <Migration close={closeMigration} />}
        {rdx && (
          <RdxLibrary
            data={state.data}
            close={() => {
              setRdx(false);
            }}
          />
        )}
      </div>
    </WorkSelectionProvider>
  );
};
export default Romdex;
