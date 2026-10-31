import { materialize } from "@/domain/accepted/core.mjs";
import type { WorkspaceSnapshot } from "@/domain/types";
import { useOrderRecovery } from "./use-order-recovery";
const OrderRecovery = ({ state }: { state: WorkspaceSnapshot }) => {
  const {
    open,
    setOpen,
    message,
    preview,
    setPreview,
    backedUp,
    confirmed,
    setConfirmed,
    busy,
    start,
    read,
    backup,
    apply,
  } = useOrderRecovery();
  const items = materialize(state.data.remote, state.data.operations);
  return (
    <section className="port-form" aria-label="Local order recovery">
      <button
        onClick={start}
        disabled={
          !state.ready ||
          !!state.error ||
          state.delivering ||
          state.updating ||
          state.pendingWrites > 0 ||
          busy
        }
      >
        Restore local order from another device
      </button>
      {open && (
        <div className="port-form">
          <p>
            This restores only sibling display order, not parent relationships.
            Use a fresh recovery export from the correct device, same account
            and project. Older exports without account/project verification
            cannot be used.
          </p>
          <label>
            Correct-device recovery or order backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                void read(event);
              }}
              disabled={busy}
            />
          </label>
          {preview && (
            <>
              <p>
                Preview: {preview.count} matching tasks. Current parent
                relationships will be preserved.
              </p>
              <ol>
                {items.map((item) => {
                  return (
                    <li key={item.id}>
                      {item.id}: {item.summary} — parent{" "}
                      {item.parentId ?? "top level"}; restored position{" "}
                      {(preview.order[item.id] ?? 0) + 1}
                    </li>
                  );
                })}
              </ol>
              <button onClick={backup} disabled={busy}>
                Download current order backup
              </button>
              <label className="port-check-line">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={!backedUp || busy}
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                  }}
                />
                I saved the current order backup and approve this order-only
                change.
              </label>
              <button
                onClick={() => {
                  void apply();
                }}
                disabled={!backedUp || !confirmed || busy}
              >
                Apply order only
              </button>
            </>
          )}
          <button
            onClick={() => {
              setOpen(false);
              setPreview(null);
            }}
            disabled={busy}
          >
            Cancel order recovery
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
};
export default OrderRecovery;
