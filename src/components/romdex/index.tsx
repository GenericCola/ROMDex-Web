"use client";
import { materialize } from "@/domain/accepted/core.mjs";
import { workspaceStore } from "@/domain/workspace-store";
import PwaControls from "@components/pwa-controls";
import type { CSSProperties } from "react";
import { useState } from "react";
import Connection from "./connection";
import Details from "./details";
import Divider from "./divider";
import Header from "./header";
import NewItem from "./new-item";
import Selectors from "./selectors";
import { useWorkspace } from "./use-workspace";
import WorkTable from "./work-table";
const Romdex = () => {
  const state = useWorkspace();
  const [connection, setConnection] = useState(false);
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
  const exportRecovery = () => {
    const blob = new Blob([workspaceStore.recover()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "ROMDex-Web-Recovery-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const { view } = state.data;
  const mode = view.detailsMode;
  const style = { "--work-height": view.workHeight + "%" } as CSSProperties;
  return (
    <div className="romdex-app">
      <Header state={state} connect={openConnection} />
      <div className="port-workspace-status">
        <p role="status">
          {state.error
            ? "Local save needs attention"
            : !state.ready
              ? "Opening browser workspace…"
              : state.pendingWrites
                ? "Saving in this browser…"
                : "All changes saved in this browser"}
        </p>
        <button onClick={exportRecovery} disabled={!state.ready}>
          Export Recovery Copy
        </button>
      </div>
      {state.error && (
        <p className="port-recovery" role="alert">
          {state.error}
        </p>
      )}
      {state.ready && (
        <div className="device-body" inert={!!state.error}>
          <Selectors data={state.data} items={items} add={add} />
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
            <main className="workspace suite-tray port-empty-workspace">
              <h2>NPCDex</h2>
              <p>
                The accepted NPCDex content workflow is next in the port. Your
                desktop maps have not been imported or changed.
              </p>
              <details>
                <summary>Install and updates</summary>
                <PwaControls beforeUpdate={workspaceStore.flush} />
              </details>
            </main>
          )}
        </div>
      )}
      <details className="port-notice">
        <summary>Web port status and updates</summary>
        <p>
          Task workflow preview · local browser saves · YouTrack reads only ·
          cloud delivery off
        </p>
        <PwaControls beforeUpdate={workspaceStore.flush} />
      </details>
      {state.data.newTask && <NewItem draft={state.data.newTask} />}{" "}
      {connection && <Connection close={closeConnection} />}
    </div>
  );
};
export default Romdex;
