import { draftMessage } from "@/domain/editor-drafts";
import type { WorkspaceSnapshot } from "@/domain/types";
import OrderRecovery from "./order-recovery";
import { exportRecovery } from "./recovery-export";
const WorkspaceStatus = ({
  state,
  drafts,
  openMigration,
  openRdx,
}: {
  state: WorkspaceSnapshot;
  drafts: boolean;
  openMigration: () => void;
  openRdx: () => void;
}) => {
  return (
    <div className="port-workspace-status">
      <p role="status">
        {state.error
          ? "Local save needs attention"
          : !state.ready
            ? "Opening browser workspace…"
            : state.delivering
              ? "Delivering supported queued changes..."
              : state.pendingWrites
                ? "Saving in this browser…"
                : drafts
                  ? draftMessage()
                  : "All changes saved in this browser"}
      </p>
      <button onClick={openRdx} disabled={!state.ready || state.delivering}>
        RDX Files
      </button>
      <button onClick={exportRecovery} disabled={!state.ready}>
        Export Recovery Copy
      </button>
      <OrderRecovery state={state} />
      <button
        onClick={openMigration}
        disabled={!state.ready || state.delivering || state.pendingWrites > 0}
      >
        Import Desktop or Recovery Data
      </button>
    </div>
  );
};
export default WorkspaceStatus;
