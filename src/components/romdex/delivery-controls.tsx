import { reviewDelivery } from "@/cloud/review";
import {
  connectDelivery,
  deliveryConnected,
  disconnectDelivery,
} from "@/cloud/session";
import { cloudData } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useState } from "react";
const DeliveryControls = () => {
  const [token, setToken] = useState("");
  const [receipt, setReceipt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const changeToken = (event: ChangeEvent<HTMLInputElement>) => {
    return setToken(event.target.value);
  };
  const changeReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    return setReceipt(event.target.value);
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
    return record.status !== "confirmed";
  });
  const render = ([id, record]: (typeof records)[number]) => {
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
        return reviewDelivery(id, "confirm", receipt);
      });
    };
    return (
      <section key={id}>
        <h3>
          {record.status === "conflict"
            ? "Conflicting edits"
            : "Uncertain delivery"}
        </h3>
        <p>{record.message}</p>
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
        <label>
          Exact comment ID, if needed
          <input value={receipt} onChange={changeReceipt} />
        </label>
        <div className="port-actions">
          <button onClick={confirm} disabled={busy}>
            Read back and confirm; do not resend
          </button>
          {record.status === "conflict" && (
            <button onClick={local} disabled={busy}>
              Keep my edit; rebase for next Save
            </button>
          )}
          <button onClick={cloud} disabled={busy}>
            Keep YouTrack; archive pending change
          </button>
        </div>
      </section>
    );
  };
  return (
    <section>
      <h3>Cloud delivery</h3>
      <p>
        Optional, session only. Save Changes sends existing-task titles, notes,
        priority, complexity and comments. Creation, deletion, hierarchy and
        assigned-status operations remain queued for the next adapter. Auto-Sync
        is off initially. Enabling delivery uses your saved preference. Avoid
        simultaneous desktop edits to the same fields. A timeout pauses
        automatic delivery until review.
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
