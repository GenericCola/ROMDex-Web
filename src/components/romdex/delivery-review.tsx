import { reviewDelivery } from "@/cloud/review";
import type { DeliveryRecord } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useState } from "react";
import AttachmentReview from "./attachment-review";
import { conflictSummary } from "./conflict-summary";
import DeletionReviewActions from "./deletion-review-actions";
import DeliveryReceipt, { StopDeliveryLabel } from "./delivery-receipt";
import DeliveryTechnicalDetails from "./delivery-technical-details";
const DeliveryReview = ({
  id,
  record,
  busy,
  execute,
}: {
  id: string;
  record: DeliveryRecord;
  busy: boolean;
  execute: (action: () => Promise<void>, success?: string) => Promise<void>;
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
  const summary = conflictSummary(operation, record);
  const renderChange = (text: string, index: number) => {
    return <li key={index}>{text}</li>;
  };
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
    <section className="delivery-review-card">
      <h3>{summary.title}</h3>
      <p>
        {record.status === "conflict"
          ? "Changed in YouTrack — your queued change is paused."
          : "Earlier delivery has an unknown outcome — nothing will be resent automatically."}
      </p>
      <p>{summary.explanation}</p>
      <ul>{summary.items.map(renderChange)}</ul>
      {operation?.type === "edit" && operation.purpose === "rollup" && (
        <p>
          This is a calculated status; your assigned choice is kept. Confirm the
          result or keep the current YouTrack value. The next Save recalculates
          from fresh tasks.
        </p>
      )}
      <DeliveryTechnicalDetails operation={operation} record={record} />
      {operation?.type === "delete" ? (
        <DeletionReviewActions
          operation={operation}
          record={record}
          busy={busy}
          execute={execute}
        />
      ) : (
        <>
          {operation &&
            (operation.type === "attachment" ||
              operation.type === "attachment-delete") && (
              <AttachmentReview operation={operation} busy={busy} />
            )}
          <DeliveryReceipt
            type={operation?.type}
            value={receipt}
            change={changeReceipt}
          />

          {operation?.type === "attachment-delete" && (
            <label className="port-check-line">
              <input
                type="checkbox"
                checked={missing}
                onChange={acknowledgeMissing}
              />
              I checked {operation.attachmentId} in YouTrack. Missing can mean
              lost access; confirming will never resend its deletion.
            </label>
          )}
          {operation?.type === "create" && (
            <p>
              Confirm by exact ID and matching task fields. Stopping creation
              archives dependent browser changes; a cloud task may already
              exist. Inspect YouTrack before creating again.
            </p>
          )}
          <div className="port-actions">
            <button
              onClick={confirm}
              disabled={
                busy ||
                (["delete", "attachment-delete"].includes(
                  operation?.type ?? "",
                ) &&
                  !missing)
              }
            >
              Read back and confirm; do not resend
            </button>
            {operation?.type === "edit" && operation.purpose !== "rollup" && (
              <button onClick={local} disabled={busy}>
                {record.status === "conflict"
                  ? "Keep my edit; rebase for next Save"
                  : "Rebase remaining edit after readback"}
              </button>
            )}
            <button onClick={cloud} disabled={busy}>
              <StopDeliveryLabel type={operation?.type} />
            </button>
          </div>
        </>
      )}
    </section>
  );
};
export default DeliveryReview;
