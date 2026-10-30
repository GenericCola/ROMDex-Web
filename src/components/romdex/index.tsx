"use client";
import { cloudData } from "@/cloud/types";
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
import type { CSSProperties, ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import Connection from "./connection";
import Details from "./details";
import Divider from "./divider";
import Header from "./header";
import Migration from "./migration";
import RdxLibrary from "./rdx-library";
import Selectors from "./selectors";
import { useInlineAction } from "./use-inline-action";
import { useWorkspace } from "./use-workspace";
import WorkTable from "./work-table";
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
  const style = { "--work-height": view.workHeight + "%" } as CSSProperties;
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
        {state.ready && (
          <div
            className="device-body"
            inert={
              !!state.error ||
              Object.values(cloudData(state.data).records).some((record) => {
                return record.status !== "confirmed";
              })
            }
          >
            {view.workspace === "romdex" ? (
              <Selectors data={state.data} items={items} add={add} />
            ) : (
              <NpcdexSidebar data={state.data} />
            )}
            {view.workspace === "romdex" ? (
              <main
                className={
                  "work-trays" +
                  (mode === "collapsed"
                    ? " details-collapsed"
                    : mode === "expanded"
                      ? " details-full"
                      : "")
                }
                style={style}
                aria-label="Work and Details Trays"
              >
                {mode !== "expanded" && (
                  <WorkTable data={state.data} items={items} add={add} />
                )}
                <Divider view={view} />
                {mode !== "collapsed" && (
                  <Details data={state.data} items={items} />
                )}
              </main>
            ) : (
              <Npcdex data={state.data} />
            )}
          </div>
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
