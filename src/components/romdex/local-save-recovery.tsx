import type { WorkspaceSnapshot } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import { exportRecovery } from "./recovery-export";
const LocalSaveRecovery = ({ state }: { state: WorkspaceSnapshot }) => {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    void workspaceStore
      .retryLocalSave()
      .catch(() => {
        // The store retains and displays the error; never discard recovery data.
      })
      .finally(() => {
        setRetrying(false);
      });
  };
  return (
    <section
      className="port-recovery"
      role="alert"
      aria-label="Local save recovery"
    >
      <p>{state.error}</p>
      <p>
        Editing and sync are paused. You can still browse. Keep this window open
        and export a recovery copy before reloading. Navigation changes are not
        saved until local saving recovers.
      </p>
      <div className="port-actions">
        <button onClick={exportRecovery} disabled={!state.ready}>
          Export Recovery Copy
        </button>
        <button
          onClick={retry}
          disabled={
            !state.ready ||
            retrying ||
            state.pendingWrites > 0 ||
            state.delivering
          }
        >
          Retry local saving
        </button>
      </div>
    </section>
  );
};
export default LocalSaveRecovery;
