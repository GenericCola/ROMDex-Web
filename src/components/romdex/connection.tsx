import { authToken } from "@/auth/session";
import { adoptTasks } from "@/cloud/assigned-status";
import { cloudData } from "@/cloud/types";
import { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { readTasks } from "@/youtrack/read-tasks";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import DeliveryControls from "./delivery-controls";
import Dialog from "./dialog";
const Connection = ({ close }: { close: () => void }) => {
  const previewEpochRef = useRef(0);
  const { delivering } = workspaceStore.getSnapshot();
  const [preview, setPreview] = useState<TaskItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    const epoch = workspaceStore.deliveryEpoch();
    setBusy(true);
    setMessage("");
    try {
      await workspaceStore.start();
      const opened = workspaceStore.getSnapshot();
      if (!opened.ready || opened.error)
        throw Error(opened.error || "Wait for your workspace to open.");
      const token = authToken();
      const items = cloudData(workspaceStore.getSnapshot().data).sharedStatuses
        ? await new DeliveryClient(token, true).all()
        : await readTasks(token);
      indexTree(items);
      if (
        workspaceStore.getSnapshot().delivering ||
        epoch !== workspaceStore.deliveryEpoch()
      )
        throw Error(
          "Delivery changed while reading. Read the tasks again after it finishes.",
        );
      previewEpochRef.current = epoch;
      setPreview(items);
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
  const savePreview = async () => {
    if (!preview) return;
    try {
      await workspaceStore.start();
      if (previewEpochRef.current !== workspaceStore.deliveryEpoch())
        throw Error(
          "Delivery changed after this preview. Read the tasks again.",
        );
      await workspaceStore.change((data) => {
        adoptTasks(data, preview);
      });
      if (workspaceStore.getSnapshot().error) return;
      workspaceStore.setConnection("YouTrack copy saved in this browser");
      close();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Browser copy was not changed.",
      );
    }
  };
  const adopt = () => {
    void savePreview();
  };
  return (
    <Dialog title="Connection Details" close={close}>
      <p>thegobindsingh.youtrack.cloud · PMON</p>
      <DeliveryControls />
      <p className="port-notice">
        Reads use your signed-in YouTrack identity. No cloud writes or desktop
        import runs. Review the result before saving a browser copy.
      </p>
      <form className="port-form" onSubmit={submit}>
        <button type="submit" disabled={busy || delivering}>
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
          <button className="primary" onClick={adopt} disabled={delivering}>
            Save {preview.length} Tasks in This Browser
          </button>
        </>
      )}
    </Dialog>
  );
};
export default Connection;
