import { authIdentity } from "@/auth/session";
import { disconnectDelivery } from "@/cloud/session";
import {
  applyOrderRecovery,
  orderBackup,
  previewOrderRecovery,
  type OrderPreview,
} from "@/domain/order-recovery";
import { workspaceStore } from "@/domain/workspace-store";
import { useState, type ChangeEvent } from "react";
import { downloadRecoveryText } from "./recovery-export";
export const useOrderRecovery = () => {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [backedUp, setBackedUp] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const assertIdle = () => {
    const now = workspaceStore.getSnapshot();
    if (
      !now.ready ||
      now.error ||
      now.delivering ||
      now.updating ||
      now.pendingWrites
    )
      throw Error(
        "Wait for local saving and delivery to finish before restoring order.",
      );
    return now.data;
  };
  const failed = (error: unknown) => {
    setMessage(
      error instanceof Error
        ? error.message
        : "Order recovery failed. Nothing else was imported.",
    );
  };
  const start = () => {
    try {
      assertIdle();
      authIdentity();
      disconnectDelivery();
      setOpen(true);
      setMessage(
        "Delivery is disconnected for recovery. No queued changes will be sent by this tool.",
      );
    } catch (error) {
      failed(error);
    }
  };
  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setBackedUp(false);
    setConfirmed(false);
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 128 * 1024 * 1024)
        throw Error("Recovery file exceeds 128 MiB.");
      const text = await file.text();
      const data = assertIdle();
      disconnectDelivery();
      setPreview(previewOrderRecovery(text, data, authIdentity()));
      setMessage(
        "Preview only. Hierarchy, notes, drafts, attachments and queued changes will not be imported.",
      );
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };
  const backup = () => {
    try {
      const data = assertIdle();
      if (JSON.stringify(data) !== preview?.baseline)
        throw Error("Workspace changed. Preview the file again.");
      downloadRecoveryText(
        orderBackup(data, authIdentity()),
        "ROMDex-Current-Order-Backup-" + Date.now() + ".json",
      );
      setBackedUp(true);
    } catch (error) {
      failed(error);
    }
  };
  const apply = async () => {
    if (!preview || !backedUp || !confirmed || busy) return;
    setBusy(true);
    try {
      assertIdle();
      disconnectDelivery();
      const scope = authIdentity();
      await workspaceStore.change((data) => {
        applyOrderRecovery(data, preview, scope);
      });
      await workspaceStore.flush();
      setPreview(null);
      setConfirmed(false);
      setBackedUp(false);
      setMessage(
        "Local order restored. Delivery remains disconnected. No hierarchy, notes, drafts, attachments or queued operations were changed.",
      );
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };
  return {
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
  };
};
