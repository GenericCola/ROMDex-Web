import { authIdentity, authToken, hasAuthSession } from "@/auth/session";
import { connectDelivery, deliveryConnected } from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import { needsDeliveryReview, reviewNotice } from "@/domain/review-browsing";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import DeliveryFeedback from "./delivery-feedback";
import DeliveryReview from "./delivery-review";
const DeliveryControls = () => {
  const { delivering } = workspaceStore.getSnapshot();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const execute = async (
    action: () => Promise<void>,
    success = "Saved. Use Save Changes to run one delivery cycle.",
  ) => {
    if (workspaceStore.getSnapshot().delivering) {
      setMessage(
        "Delivery is running. Review actions resume when it finishes.",
      );
      return;
    }
    setBusy(true);
    setMessage("Checking…");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Delivery setup failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const connect = () => {
    const action = async () => {
      await connectDelivery(authToken(), authIdentity().userId);
    };
    void execute(action);
  };
  const records = Object.entries(
    cloudData(workspaceStore.getSnapshot().data).records,
  ).filter(([, record]) => {
    return record.status !== "confirmed" && record.status !== "ready";
  });
  const render = ([id, record]: (typeof records)[number]) => {
    return (
      <DeliveryReview
        key={id}
        id={id}
        record={record}
        busy={busy || delivering}
        execute={execute}
      />
    );
  };
  return (
    <section className="delivery-controls-panel">
      <h3>Cloud delivery</h3>
      <p>
        Connected automatically after verified sign-in. Save Changes delivers
        new tasks, listed deletions, hierarchy, assigned status with parent
        rollups, titles, notes, priority, complexity and comments. Assigned
        choices stay in this browser while shared status is disabled; recovery
        exports retain them. Calculated statuses go to YouTrack State. Deletions
        permanently remove only the reviewed list. Auto-Sync honors your saved
        preference. Turning it off stops automatic delivery, while manual Save
        and review remain available. Avoid simultaneous desktop edits to the
        same fields. A timeout pauses automatic delivery until review.
      </p>
      <p role="status">
        {deliveryConnected()
          ? "Data connection ready."
          : "Data connection unavailable. No queued changes will be sent."}
      </p>
      {!deliveryConnected() && (
        <button
          onClick={connect}
          disabled={busy || delivering || !hasAuthSession()}
        >
          Retry data connection
        </button>
      )}
      {needsDeliveryReview(workspaceStore.getSnapshot().data) && (
        <p>
          {reviewNotice(workspaceStore.getSnapshot().data)} Browsing is
          available; task edits are paused until review and delivery complete.
        </p>
      )}
      {records.map(render)}
      <DeliveryFeedback message={message} />
      <p>
        Shared assigned status is unavailable while its concurrency safety check
        remains unresolved.
      </p>
    </section>
  );
};
export default DeliveryControls;
