import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { readTasks } from "@/youtrack/read-tasks";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import DeliveryControls from "./delivery-controls";
import Dialog from "./dialog";
const Connection = ({ close }: { close: () => void }) => {
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<TaskItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    return setToken(event.target.value);
  };
  const load = async () => {
    setBusy(true);
    setMessage("");
    try {
      const items = await readTasks(token);
      indexTree(items);
      setPreview(items);
      setToken("");
      setMessage(
        items.length + " tasks read. Review before saving a browser copy.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Read failed.");
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load();
  };
  const adopt = () => {
    if (!preview) return;
    void workspaceStore
      .change((data) => {
        data.remote = preview;
      })
      .then(() => {
        if (workspaceStore.getSnapshot().error) return;
        workspaceStore.setConnection("YouTrack copy saved in this browser");
        close();
      });
  };
  return (
    <Dialog title="Connection Details" close={close}>
      <p>thegobindsingh.youtrack.cloud · PMON</p>
      <DeliveryControls />
      <p className="port-notice">
        This step reads tasks only. No cloud writes, field setup or desktop-data
        import runs. The token stays in this dialog's memory and is discarded
        after the read or when the dialog closes.
      </p>
      <form className="port-form" onSubmit={submit}>
        <label htmlFor="youtrack-token">YouTrack Permanent Token</label>
        <input
          id="youtrack-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={change}
          required
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Reading…" : "Read YouTrack Tasks"}
        </button>
      </form>
      <p role="status">{message}</p>
      {preview && (
        <>
          <p>
            Saving this copy refreshes the browser's remote baseline and retains
            its local queued edits. Existing desktop data stays intact.
          </p>
          <button className="primary" onClick={adopt}>
            Save {preview.length} Tasks in This Browser
          </button>
        </>
      )}
    </Dialog>
  );
};
export default Connection;
