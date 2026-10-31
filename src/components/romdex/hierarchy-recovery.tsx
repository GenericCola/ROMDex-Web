import { recoveryMode } from "@/auth/recovery-mode";
import type { WorkspaceSnapshot } from "@/domain/types";
import { useHierarchyRecovery } from "./use-hierarchy-recovery";
const HierarchyRecovery = ({ state }: { state: WorkspaceSnapshot }) => {
  const recovery = useHierarchyRecovery();
  if (!recoveryMode()) return null;
  return (
    <section aria-label="Local hierarchy recovery">
      <button
        onClick={() => {
          void recovery.read();
        }}
        disabled={
          !state.ready ||
          !!state.error ||
          state.delivering ||
          state.updating ||
          state.pendingWrites > 0 ||
          recovery.busy
        }
      >
        Review parent relationships from YouTrack
      </button>
      <p>
        No file is required. Reading the preview does not write to YouTrack.
        Choose the changes to repair; nothing is selected by time or
        automatically.
      </p>
      {recovery.preview && (
        <div className="port-form">
          <p>
            For selected items only, use the current server parent and discard
            the pending parent change if one exists. Preserve notes, titles,
            other edited fields, drafts, attachments, local order and unrelated
            queued work.
          </p>
          {recovery.preview.blockedReason && (
            <p role="status">{recovery.preview.blockedReason}</p>
          )}
          {!recovery.preview.items.length && (
            <p>No differing parent relationships were found.</p>
          )}
          <ul>
            {recovery.preview.items.map((item) => {
              return (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={"Repair parent for " + item.issueId}
                      checked={recovery.selected.includes(item.id)}
                      disabled={recovery.busy || !!item.blockedReason}
                      onChange={(event) => {
                        recovery.toggle(item.id, event.target.checked);
                      }}
                    />
                    {item.issueId}: {item.summary}
                  </label>
                  <p>
                    Local parent: {item.localParentId ?? "Top level"}. Current
                    YouTrack parent: {item.serverParentId ?? "Top level"}.
                  </p>
                  <p>
                    {item.opId
                      ? "Discard only this pending parent change; keep other edited fields."
                      : "Refresh this local parent from the server; no pending parent patch will be removed."}
                  </p>
                  {item.blockedReason && (
                    <p role="status">
                      Cannot repair this item here: {item.blockedReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {!!recovery.preview.items.length && (
            <>
              <p>
                {recovery.selected.length} item(s) selected. A local recovery
                backup is retained before applying.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={recovery.confirmed}
                  disabled={recovery.busy || !recovery.selected.length}
                  onChange={(event) => {
                    recovery.setConfirmed(event.target.checked);
                  }}
                />
                I approve these selected local parent repairs and want all other
                work preserved.
              </label>
              <button
                onClick={() => {
                  void recovery.apply();
                }}
                disabled={
                  recovery.busy ||
                  !recovery.selected.length ||
                  !recovery.confirmed
                }
              >
                Apply selected local parent repairs
              </button>
            </>
          )}
        </div>
      )}
      {(recovery.preview !== null || recovery.busy) && (
        <button onClick={recovery.cancel} disabled={recovery.applying}>
          Close hierarchy preview
        </button>
      )}
      <p>
        Exiting keeps local order unchanged and turns Auto-Sync off. Unrelated
        queued work remains; review it before using Save Changes later. Exit is
        blocked until current hierarchy and uncertain delivery outcomes are
        verified.
      </p>
      <button
        onClick={() => {
          void recovery.exit();
        }}
        disabled={
          recovery.busy ||
          !state.ready ||
          !!state.error ||
          state.delivering ||
          state.updating ||
          state.pendingWrites > 0
        }
      >
        Exit recovery with Auto-Sync off
      </button>
      {recovery.message && <p role="status">{recovery.message}</p>}
    </section>
  );
};
export default HierarchyRecovery;
