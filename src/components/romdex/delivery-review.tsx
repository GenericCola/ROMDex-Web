import { reviewDelivery } from "@/cloud/review";
import type { DeliveryRecord } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useState } from "react";
const DeliveryReview = ({
  id,
  record,
  busy,
  execute,
}: {
  id: string;
  record: DeliveryRecord;
  busy: boolean;
  execute: (action: () => Promise<void>) => Promise<void>;
}) => {
  const [receipt, setReceipt] = useState("");
  const [missing, setMissing] = useState(false);
  const changeReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    setReceipt(event.target.value);
  };
  const acknowledgeMissing = (event: ChangeEvent<HTMLInputElement>) => {
    setMissing(event.target.checked);
  };
  const operation = workspaceStore
    .getSnapshot()
    .data.operations.find((entry) => {
      return entry.opId === id;
    });
  const cloud = () => {
    void execute(() => {
      return reviewDelivery(id, "cloud");
    });
  };
  const local = () => {
    void execute(() => {
      return reviewDelivery(id, "local");
    });
  };
  const confirm = () => {
    void execute(() => {
      return reviewDelivery(id, "confirm", receipt, missing);
    });
  };
  return (
    <section>
      <h3>
        {record.status === "conflict"
          ? "Conflicting edits"
          : "Uncertain delivery"}
      </h3>
      <p>{record.message}</p>
      {operation?.type === "edit" && operation.purpose === "rollup" && (
        <p>
          This is a calculated status; your assigned choice is kept. Confirm the
          result or keep the current YouTrack value. The next Save recalculates
          from fresh tasks.
        </p>
      )}
      <details>
        <summary>Queued change for {operation?.issueId}</summary>
        <pre className="port-detail-text">
          {JSON.stringify(operation, null, 2)}
        </pre>
      </details>
      {record.conflicts && (
        <pre className="port-detail-text">
          {JSON.stringify(record.conflicts, null, 2)}
        </pre>
      )}
      {record.remoteTasks && (
        <details open>
          <summary>Current deletion targets</summary>
          <pre className="port-detail-text">
            {JSON.stringify(record.remoteTasks, null, 2)}
          </pre>
        </details>
      )}
      <label>
        {operation?.type === "create"
          ? "Exact created issue ID (PMON-number)"
          : "Exact comment ID, if needed"}
        <input value={receipt} onChange={changeReceipt} />
      </label>
      {operation?.type === "delete" && (
        <label>
          <input
            type="checkbox"
            checked={missing}
            onChange={acknowledgeMissing}
          />
          I checked {record.targetId ?? operation.issueId} in YouTrack. Missing
          can mean lost access; confirming will never resend its deletion.
        </label>
      )}
      {operation?.type === "create" && (
        <p>
          Confirm by exact ID and matching task fields. Stopping creation
          archives dependent browser changes; a cloud task may already exist.
          Inspect YouTrack before creating again.
        </p>
      )}
      <div className="port-actions">
        <button
          onClick={confirm}
          disabled={busy || (operation?.type === "delete" && !missing)}
        >
          Read back and confirm; do not resend
        </button>
        {((operation?.type === "edit" && operation.purpose !== "rollup") ||
          operation?.type === "delete") && (
          <button onClick={local} disabled={busy}>
            {operation.type === "delete"
              ? "Approve remaining listed deletions after readback"
              : record.status === "conflict"
                ? "Keep my edit; rebase for next Save"
                : "Rebase remaining edit after readback"}
          </button>
        )}
        <button onClick={cloud} disabled={busy}>
          {operation?.type === "create"
            ? "Stop creation and dependent changes; archive"
            : operation?.type === "delete"
              ? "Stop remaining deletions; archive"
              : "Keep YouTrack; archive pending change"}
        </button>
      </div>
    </section>
  );
};
export default DeliveryReview;
