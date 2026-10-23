"use client";
import { cloudData } from "@/cloud/types";

import { materialize } from "@/domain/accepted/core.mjs";
import {
  hasDraftEdits,
  noDraftEdits,
  subscribeDraftEditors,
} from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import Npcdex from "@components/npcdex";
import NpcdexSidebar from "@components/npcdex/sidebar";
import PwaControls from "@components/pwa-controls";
import type { CSSProperties } from "react";
import { useState, useSyncExternalStore } from "react";
import Connection from "./connection";
import Details from "./details";
import Divider from "./divider";
import Header from "./header";
import Migration from "./migration";
import NewItem from "./new-item";
import RdxLibrary from "./rdx-library";
import Selectors from "./selectors";
import { useWorkspace } from "./use-workspace";
import WorkTable from "./work-table";
import WorkspaceStatus from "./workspace-status";
const Romdex = () => {
  const state = useWorkspace();
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
    void workspaceStore.change((data) => {
      data.newTask = { title: "", parentId };
    });
  };
  const { view } = state.data;
  const mode = view.detailsMode;
  const style = { "--work-height": view.workHeight + "%" } as CSSProperties;
  return (
    <div className="romdex-app" inert={state.updating || state.delivering}>
      <Header
        state={state}
        connect={openConnection}
        unsavedDrafts={draftEdits}
      />
      <WorkspaceStatus
        state={state}
        drafts={draftEdits}
        openMigration={openMigration}
        openRdx={() => {
          setRdx(true);
        }}
      />
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
      <details className="port-notice">
        <summary>Web port status and updates</summary>
        <p>
          Task workflow preview · durable browser saves · YouTrack task reads ·
          optional session delivery for existing tasks
        </p>
        <PwaControls beforeUpdate={workspaceStore.prepareUpdate} />
      </details>
      {state.data.newTask && <NewItem draft={state.data.newTask} />}{" "}
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
  );
};
export default Romdex;
