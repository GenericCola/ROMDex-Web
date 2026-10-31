import type { WorkspaceData } from "@/domain/types";
import { proposedOperationSummary } from "./review-operation-summary";
const SyncRecoveryPanel = ({
  data,
  connection,
  reviews,
  connected,
  busy,
  retry,
}: {
  data: WorkspaceData;
  connection: string;
  reviews: number;
  connected: boolean;
  busy: boolean;
  retry: () => void;
}) => {
  const hasMoves = data.operations.some((operation) => {
    return operation.type === "edit" && "parentId" in operation.patch;
  });
  return (
    <section aria-label="Sync recovery">
      <h3>Resume paused sync</h3>
      <p>{connection}</p>
      <p>
        {reviews
          ? "Review each ticket below. Choose which version to keep, or check an unknown result without resending it. When all reviews are resolved, retry the remaining queued changes."
          : hasMoves
            ? "A queued parent move needs care. If the message above says quarantined, do not retry it; review the move using recovery mode first."
            : "No unresolved merge or unknown request is recorded. You can explicitly retry the queued changes. A failed retry keeps them here for review."}
      </p>
      {!reviews && data.operations.length > 0 && (
        <>
          <h4>Pending changes ({data.operations.length})</h4>
          <ul>
            {data.operations.slice(0, 5).map((operation) => {
              return (
                <li key={operation.opId}>
                  {operation.issueId}:{" "}
                  {proposedOperationSummary(operation).join(" ")}
                </li>
              );
            })}
          </ul>
          {data.operations.length > 5 && (
            <p>Additional queued changes are also retained.</p>
          )}
        </>
      )}
      {!reviews && !hasMoves && connected && (
        <button onClick={retry} disabled={busy}>
          Retry queued changes
        </button>
      )}
    </section>
  );
};
export default SyncRecoveryPanel;
