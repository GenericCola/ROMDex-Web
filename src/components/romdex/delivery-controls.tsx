import {
  connectDelivery,
  deliveryConnected,
  disconnectDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useState } from "react";
import DeliveryReview from "./delivery-review";
const DeliveryControls = () => {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const changeToken = (event: ChangeEvent<HTMLInputElement>) => {
    return setToken(event.target.value);
  };
  const execute = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setMessage("Saved. Use Save Changes to run one delivery cycle.");
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
      await connectDelivery(token);
      setToken("");
    };
    void execute(action);
  };
  const disconnect = () => {
    disconnectDelivery();
    setToken("");
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
        deletions, hierarchy, native State, titles, notes, priority, complexity
        and comments. Deletions permanently remove only the reviewed list.
        Auto-Sync is off initially. Enabling delivery uses your saved
        preference. Avoid simultaneous desktop edits to the same fields. A
        timeout pauses automatic delivery until review.
      </p>
      <label>
        Session token for delivery
        <input
          type="password"
          value={token}
          onChange={changeToken}
          autoComplete="off"
        />
      </label>
      <div className="port-actions">
        <button onClick={connect} disabled={busy || !token.trim()}>
          Enable delivery for this session
        </button>
        <button onClick={disconnect} disabled={busy || !deliveryConnected()}>
          Disconnect delivery
        </button>
      </div>
      <p role="status">{message}</p>
      {records.map(render)}
    </section>
  );
};
export default DeliveryControls;
