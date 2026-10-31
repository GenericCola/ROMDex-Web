import { authIdentity, authToken, hasAuthSession } from "@/auth/session";
import { reportDeliveryFailure } from "@/cloud/delivery-failure";
import { incomingMessage, subscribeIncoming } from "@/cloud/incoming-status";
import {
  connectDelivery,
  deliveryConnected,
  deliveryPaused,
  saveDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useRef, useState, useSyncExternalStore } from "react";
import DeliveryFeedback from "./delivery-feedback";
import DeliveryReview from "./delivery-review";
import SyncRecoveryPanel from "./sync-recovery-panel";
const DeliveryControls = () => {
  const { delivering, data, connection } = workspaceStore.getSnapshot();
  const incoming = useSyncExternalStore(
    subscribeIncoming,
    incomingMessage,
    () => {
      return "";
    },
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);
  const execute = async (
    action: () => Promise<void | string>,
    success = "Connected. Your changes are kept on this device until saved.",
  ) => {
    if (runningRef.current) return;
    if (workspaceStore.getSnapshot().delivering) {
      setMessage(
        "Saving is in progress. Please wait before reviewing this change.",
      );
      return;
    }
    runningRef.current = true;
    setBusy(true);
    setMessage("Checking…");
    try {
      const result = await action();
      setMessage(result ?? success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Delivery setup failed.",
      );
    } finally {
      runningRef.current = false;
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
  const retry = () => {
    void execute(() => {
      return saveDelivery().catch((error: unknown) => {
        reportDeliveryFailure(error);
        throw error;
      });
    });
  };
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
      <h3>Save to YouTrack</h3>
      {incoming && <p role="status">{incoming}</p>}
      {!deliveryConnected() && (
        <p>Not connected. Your changes are kept on this device.</p>
      )}
      {!deliveryConnected() && (
        <button
          onClick={connect}
          disabled={busy || delivering || !hasAuthSession()}
        >
          Retry data connection
        </button>
      )}
      {(deliveryPaused() ||
        data.operations.length > 0 ||
        !!cloudData(data).rollupPending ||
        !!cloudData(data).unavailable ||
        records.length > 0) && (
        <SyncRecoveryPanel
          data={data}
          connection={connection}
          reviews={records.length}
          connected={deliveryConnected()}
          busy={busy || delivering}
          retry={retry}
        />
      )}
      {records.map(render)}
      <DeliveryFeedback message={message} />
    </section>
  );
};
export default DeliveryControls;
