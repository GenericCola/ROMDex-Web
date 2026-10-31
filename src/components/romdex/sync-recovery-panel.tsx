import {
  blockedByDeletion,
  deletionReviewTickets,
} from "@/cloud/deletion-isolation";
import { cloudData } from "@/cloud/types";
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
  const failure = /^(Automatic delivery paused|Save stopped):/.test(connection);
  const { unavailable } = cloudData(data);
  const statusPending =
    !!cloudData(data).rollupPending || !!unavailable?.blockedIds.length;
  const pending = data.operations.length > 0 || statusPending;
  const hasMoves = data.operations.some((operation) => {
    return operation.type === "edit" && "parentId" in operation.patch;
  });
  const otherChanges =
    reviews > 0 &&
    deletionReviewTickets(data).size > 0 &&
    data.operations.some((op) => {
      return !blockedByDeletion(op, data) && op.type !== "delete";
    });
  return (
    <section aria-label="Sync recovery">
      <h3>
        {reviews
          ? "Choose what to keep"
          : failure
            ? "Save stopped"
            : pending
              ? "Ready to save"
              : "No changes to save"}
      </h3>
      {failure && (
        <p role="alert">
          {connection.replace(
            /^(Automatic delivery paused|Save stopped):\s*/,
            "",
          )}
        </p>
      )}
      {reviews ? (
        <p>
          {otherChanges
            ? "The deletion below needs checking. Other changes can still sync."
            : "Resolve the changes below before saving."}
        </p>
      ) : hasMoves ? (
        <p>A task move needs review in recovery mode before it can be saved.</p>
      ) : (
        <p>
          {!data.operations.length
            ? statusPending
              ? "Ticket changes saved; parent status updates still need to finish."
              : "No pending changes are listed on this device."
            : failure
              ? "Your changes are kept on this device. You can try saving again."
              : data.operations.length === 1
                ? "Your choice is ready to save to YouTrack."
                : "Your changes are ready to save to YouTrack."}
        </p>
      )}
      {unavailable && (
        <p>
          {unavailable.deniedIds?.length
            ? `Access denied for ${unavailable.deniedIds.join(", ")}. `
            : `Could not read ${unavailable.missingIds.join(", ") || "archived tasks"}. `}
          Their local copies are kept.
          {unavailable.blockedIds.length > 0 &&
            ` Status updates for ${unavailable.blockedIds.join(", ")} are waiting; other changes can sync.`}
        </p>
      )}
      {connection && !failure && (
        <details>
          <summary>Connection details</summary>
          <p>{connection}</p>
        </details>
      )}
      {!reviews && data.operations.length > 0 && (
        <>
          <h4>Changes to save ({data.operations.length})</h4>
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
            <p>{data.operations.length - 5} more changes are included.</p>
          )}
        </>
      )}
      {(!reviews || otherChanges) && !hasMoves && connected && pending && (
        <button onClick={retry} disabled={busy}>
          {otherChanges
            ? "SAVE OTHER CHANGES"
            : !data.operations.length
              ? unavailable?.blockedIds.length
                ? "CHECK UNAVAILABLE TASKS AGAIN"
                : "SAVE STATUS UPDATES"
              : data.operations.length === 1
                ? "SAVE CHANGE"
                : `SAVE ${data.operations.length} CHANGES`}
        </button>
      )}
    </section>
  );
};
export default SyncRecoveryPanel;
