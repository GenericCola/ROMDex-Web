import { deliveryConnected } from "@/cloud/session";
import type { SharedStatusPreview } from "@/cloud/shared-status-migration";
import {
  enableSharedStatuses,
  previewSharedStatuses,
} from "@/cloud/shared-status-session";
import { cloudData } from "@/cloud/types";
import { workspaceStore } from "@/domain/workspace-store";
import { useState } from "react";
const SharedStatusControls = ({
  busy,
  execute,
}: {
  busy: boolean;
  execute: (action: () => Promise<void>) => Promise<void>;
}) => {
  const [preview, setPreview] = useState<SharedStatusPreview | null>(null);
  const enabled = cloudData(workspaceStore.getSnapshot().data).sharedStatuses;
  const load = () => {
    void execute(async () => {
      setPreview(await previewSharedStatuses());
    });
  };
  const enable = (choice: "cloud" | "browser") => {
    void execute(async () => {
      if (!preview) return;
      await enableSharedStatuses(preview, choice);
      setPreview(null);
    });
  };
  const cloud = () => {
    enable("cloud");
  };
  const browser = () => {
    enable("browser");
  };
  const cancel = () => {
    setPreview(null);
  };
  if (enabled)
    return (
      <p>
        Shared assigned status is enabled. Save Changes refreshes YouTrack
        choices; Auto-Sync also checks while idle. Missing or incompatible
        metadata stops delivery.
      </p>
    );
  return (
    <section>
      <h3>Shared assigned status</h3>
      <p>
        Requires the ROMDex status app installed in YouTrack. Preview compares
        saved browser choices with YouTrack. Enabling keeps recovery evidence
        and queues any chosen browser differences for the next Save. Use this on
        each web device; desktop data stays intact.
      </p>
      <button disabled={busy || !deliveryConnected()} onClick={load}>
        Preview shared assigned status
      </button>
      {preview && (
        <>
          <table>
            <caption>Assigned-status comparison</caption>
            <thead>
              <tr>
                <th>Task</th>
                <th>This browser</th>
                <th>YouTrack</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item) => {
                return (
                  <tr key={item.id}>
                    <th>{item.id}</th>
                    <td>{preview.local[item.id] ?? "No saved choice"}</td>
                    <td>
                      {item.assignedState}
                      {!item.sharedStatus?.initialized &&
                        " (native State; metadata not yet stored)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="port-actions">
            <button disabled={busy} onClick={cloud}>
              Use YouTrack choices and enable sharing
            </button>
            <button disabled={busy} onClick={browser}>
              Keep browser differences and enable sharing
            </button>
            <button disabled={busy} onClick={cancel}>
              Cancel shared-status preview
            </button>
          </div>
        </>
      )}
    </section>
  );
};
export default SharedStatusControls;
