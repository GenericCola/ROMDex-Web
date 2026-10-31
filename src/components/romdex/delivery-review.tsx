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
import ReviewGuidance from "./review-guidance";
import {
  reviewChoiceLabel,
  reviewResultMessage,
} from "./review-operation-summary";
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
  const [receipt, setReceipt] = useState(""),
    [missing, setMissing] = useState(false);
  const changeReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    setReceipt(event.target.value);
  };
  const acknowledgeMissing = (event: ChangeEvent<HTMLInputElement>) => {
    setMissing(event.target.checked);
  };
  const { data } = workspaceStore.getSnapshot();
  const operation = data.operations.find((entry) => {
    return entry.opId === id;
  });
  const task =
    operation?.type === "edit"
      ? operation.base
      : operation?.type === "create"
        ? operation.item
        : data.remote.find((entry) => {
            return entry.id === operation?.issueId;
          });
  const summary = conflictSummary(operation, record, task?.summary);
  const renderChange = (text: string, index: number) => {
    return <li key={index}>{text}</li>;
  };
  const run = (choice: "cloud" | "local" | "confirm") => {
    void execute(() => {
      return reviewDelivery(id, choice, receipt, missing);
    }, reviewResultMessage(choice));
  };
  const cloud = () => {
    run("cloud");
  };
  const local = () => {
    run("local");
  };
  const confirm = () => {
    run("confirm");
  };
  return (
    <section className="delivery-review-card">
      <h3>{summary.title}</h3>
      <p>
        {record.status === "conflict"
          ? "Changed in YouTrack — your queued change is paused."
          : "Earlier delivery has an unknown outcome — nothing will be resent automatically."}
      </p>
      <p>
        <strong>Why this needs review:</strong>{" "}
        {record.message || "No failure details were saved."}
      </p>
      <p>{summary.explanation}</p>
      <ul>{summary.items.map(renderChange)}</ul>
      {operation?.type === "edit" && operation.purpose === "rollup" && (
        <ReviewGuidance choice="rollup" />
      )}
      {operation?.type !== "delete" && <ReviewGuidance choice="check" />}
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
          {operation?.type === "create" && <ReviewGuidance choice="create" />}
          <div className="port-actions">
            <button
              onClick={confirm}
              disabled={
                busy ||
                !operation ||
                (["delete", "attachment-delete"].includes(
                  operation?.type ?? "",
                ) &&
                  !missing)
              }
            >
              Check YouTrack; confirm without resending
            </button>
            {operation?.type === "edit" && operation.purpose !== "rollup" && (
              <div>
                <ReviewGuidance choice="keep" />
                <button onClick={local} disabled={busy}>
                  {reviewChoiceLabel(operation, record, true) ??
                    "Keep my changes for next Save"}
                </button>
              </div>
            )}
            <ReviewGuidance choice="stop" />
            <button onClick={cloud} disabled={busy || !operation}>
              {reviewChoiceLabel(operation, record, false) ?? (
                <StopDeliveryLabel type={operation?.type} />
              )}
            </button>
          </div>
        </>
      )}
      <DeliveryTechnicalDetails operation={operation} record={record} />
    </section>
  );
};
export default DeliveryReview;
