import { reviewDelivery } from "@/cloud/review";
import { cloudData, type DeliveryRecord } from "@/cloud/types";
import type { TaskOperation } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState, type ChangeEvent } from "react";
type Deletion = Extract<TaskOperation, { type: "delete" }>;
const DeletionReviewActions = ({
  operation,
  record,
  busy,
  execute,
}: {
  operation: Deletion;
  record: DeliveryRecord;
  busy: boolean;
  execute: (action: () => Promise<void>, success?: string) => Promise<void>;
}) => {
  const [approved, setApproved] = useState<DeliveryRecord | null>(null);
  const [missing, setMissing] = useState<DeliveryRecord | null>(null);
  const remaining = operation.ids.filter((id) => {
    return !record.deletedIds?.includes(id);
  });
  const approve = (event: ChangeEvent<HTMLInputElement>) => {
    setApproved(event.target.checked ? record : null);
  };
  const acknowledgeMissing = (event: ChangeEvent<HTMLInputElement>) => {
    setMissing(event.target.checked ? record : null);
  };
  const run = (choice: "cloud" | "local" | "confirm") => {
    void execute(
      async () => {
        const current = workspaceStore.getSnapshot().data;
        if (
          cloudData(current).records[operation.opId] !== record ||
          !current.operations.includes(operation)
        )
          throw Error(
            "This review changed. Read the updated details before choosing.",
          );
        if (choice === "local" && approved !== record)
          throw Error(
            "Review and explicitly approve the remaining deletion targets first.",
          );
        await reviewDelivery(operation.opId, choice, "", missing === record);
      },
      choice === "local"
        ? "Deletion targets rechecked and approved. The deletion is queued, not yet completed. Close Connection Details and use Save Changes to explicitly retry. Save runs another check before deleting; paused Auto-Sync does not resume from this approval."
        : choice === "cloud"
          ? "Remaining queued deletion cancelled. Earlier confirmed deletions were not undone."
          : "Earlier deletion outcome checked. Review any remaining queued targets before Save Changes.",
    );
  };
  const keep = () => {
    run("cloud");
  };
  const recheck = () => {
    run("local");
  };
  const confirm = () => {
    run("confirm");
  };
  const uncertain =
    record.status === "uncertain" || record.status === "attempting";
  return (
    <section aria-label="Review queued deletion">
      <p>
        No deletion is retried from this review. Keeping tasks cancels the
        remaining queued deletion; any earlier confirmed deletion is not undone.
      </p>
      <button onClick={keep} disabled={busy}>
        Keep tasks; cancel remaining queued deletion
      </button>
      <details>
        <summary>I still want to delete the remaining tasks</summary>
        <p>
          Remaining targets: {remaining.join(", ") || "None"}. Approval reads
          them again and stops if anything changed. It prepares the deletion for
          a later Save or enabled delivery cycle; it is not an undoable local
          edit.
        </p>
        <label className="deletion-review-confirmation">
          <input
            type="checkbox"
            checked={approved === record}
            onChange={approve}
          />
          I reviewed these exact targets and still want them permanently
          deleted.
        </label>
        <button onClick={recheck} disabled={busy || approved !== record}>
          Recheck and approve these deletions
        </button>
      </details>
      {uncertain && (
        <details>
          <summary>Check whether an earlier deletion already happened</summary>
          <label className="deletion-review-confirmation">
            <input
              type="checkbox"
              checked={missing === record}
              onChange={acknowledgeMissing}
            />
            I checked {record.targetId ?? operation.issueId} in YouTrack.
            Missing can mean lost access. This check never resends deletion.
          </label>
          <button onClick={confirm} disabled={busy || missing !== record}>
            Read back the earlier outcome; do not resend
          </button>
        </details>
      )}
    </section>
  );
};
export default DeletionReviewActions;
