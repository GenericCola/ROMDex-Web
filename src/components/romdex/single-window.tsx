"use client";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import AuthShell from "./auth-shell";
import { claimWindow, type WindowRole } from "./single-window-lock";
/** Saves and freezes this window's workspace before another window takes over. */
const handOver = async () => {
  const delivered = () => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (workspaceStore.getSnapshot().delivering) return;
        stop();
        resolve();
      };
      const stop = workspaceStore.subscribe(check);
      check();
    });
  };
  await delivered();
  await workspaceStore.prepareUpdate();
};
const reload = () => {
  window.location.reload();
};
const SingleWindow = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<WindowRole>("checking");
  const takeOverRef = useRef<() => void>(reload);
  const claim = () => {
    const claimed = claimWindow(
      {
        locks: typeof navigator === "undefined" ? undefined : navigator.locks,
        channel:
          typeof BroadcastChannel === "undefined"
            ? undefined
            : new BroadcastChannel("romdex-window"),
        handOver,
        reload,
      },
      setRole,
    );
    takeOverRef.current = claimed.takeOver;
    return claimed.stop;
  };
  useEffect(claim, []);
  const takeOver = () => {
    takeOverRef.current();
  };
  if (role === "active") return children;
  if (role === "checking")
    return (
      <AuthShell>
        <p role="status">Opening ROMDex…</p>
      </AuthShell>
    );
  return (
    <AuthShell>
      <section
        className="auth-card suite-tray port-form"
        aria-label="ROMDex window"
      >
        <h2>ROMDex is open in another window</h2>
        <p>
          Only one window syncs and saves at a time, so neither can overwrite
          the other. Use ROMDex here to move it to this window; the other window
          stops and shows this notice.
        </p>
        <div className="port-actions">
          <button onClick={takeOver}>Use here</button>
        </div>
      </section>
    </AuthShell>
  );
};
export default SingleWindow;
