import { authToken, hasAuthSession } from "@/auth/session";
import {
  connectDelivery,
  deliveryConnected,
  disconnectDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
import DeliveryFeedback from "./delivery-feedback";
import DeliveryReview from "./delivery-review";
const DeliveryControls = () => {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const execute = async (
    action: () => Promise<void>,
    success = "Saved. Use Save Changes to run one delivery cycle.",
  ) => {
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
      await connectDelivery(authToken());
    };
    void execute(action);
  };
  const disconnect = () => {
    disconnectDelivery();
    setMessage("Disconnected. Queue and drafts kept; session token discarded.");
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
        busy={busy}
        execute={execute}
      />
    );
  };
  return (
    <section>
      <h3>Cloud delivery</h3>
      <p>
        Optional, session only. Save Changes delivers new tasks, listed
        deletions, hierarchy, assigned status with parent rollups, titles,
        notes, priority, complexity and comments. Assigned choices stay in this
        browser while shared status is disabled; recovery exports retain them.
        Calculated statuses go to YouTrack State. Deletions permanently remove
        only the reviewed list. Auto-Sync is off initially. Enabling delivery
        uses your saved preference. Avoid simultaneous desktop edits to the same
        fields. A timeout pauses automatic delivery until review.
      </p>
      <div className="port-actions">
        <button onClick={connect} disabled={busy || !hasAuthSession()}>
          Enable delivery for this session
        </button>
        <button onClick={disconnect} disabled={busy || !deliveryConnected()}>
          Disconnect delivery
        </button>
      </div>
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
