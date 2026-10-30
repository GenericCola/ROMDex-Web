import { ResumeRejected } from "@/auth/resume-failure";
import { authRequestGuard } from "@/auth/session";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { hasTaskTextEditing } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { connectionNeedsManualSave } from "./connection-policy";
import { deliverQueue } from "./delivery";
import { cloudData } from "./types";
let client: DeliveryClient | null = null;
let suspended = false;
let connectionGeneration = 0;
export const connectDelivery = async (
  token: string,
  expectedUserId?: string,
) => {
  const generation = ++connectionGeneration;
  const checkAuth = authRequestGuard(token);
  const assertCurrent = () => {
    checkAuth();
    if (generation !== connectionGeneration)
      throw Error("Connection changed. Enable delivery again.");
  };
  await workspaceStore.start();
  assertCurrent();
  const opened = workspaceStore.getSnapshot();
  if (!opened.ready || opened.error)
    throw Error(opened.error || "Wait for your workspace to open.");
  if (cloudData(opened.data).sharedStatuses)
    throw Error(
      "Shared status remains disabled until its concurrency safety check passes.",
    );
  const next = new DeliveryClient(
    token,
    cloudData(workspaceStore.getSnapshot().data).sharedStatuses ?? false,
  );
  await next.connect();
  assertCurrent();
  if (expectedUserId && next.accountId !== expectedUserId)
    throw new ResumeRejected(
      "The data connection identity differs from the signed-in account.",
    );
  const bound = cloudData(workspaceStore.getSnapshot().data).accountId;
  if (bound && bound !== next.accountId)
    throw Error("The queue is bound to a different account.");
  await workspaceStore.change((data) => {
    data.cloud = { ...cloudData(data), accountId: next.accountId };
  });
  await workspaceStore.flush();
  assertCurrent();
  client = next;
  suspended = connectionNeedsManualSave(workspaceStore.getSnapshot().data);
  workspaceStore.setConnection(
    suspended
      ? "Data connection ready. Reviewed changes remain paused until Save Changes."
      : "YouTrack data connected",
  );
};
export const disconnectDelivery = () => {
  ++connectionGeneration;
  client = null;
  suspended = true;
  workspaceStore.setConnection("Not connected");
};
export const deliveryPaused = () => {
  return client !== null && suspended;
};
export const deliveryConnected = () => {
  return client !== null;
};
export const saveDelivery = async (automatic = false) => {
  await flushDraftEditors();
  if (
    automatic &&
    (hasTaskTextEditing() ||
      !cloudData(workspaceStore.getSnapshot().data).autoSync)
  )
    return "Saved in this browser. Automatic delivery is waiting.";
  if (!client) {
    await workspaceStore.flush();
    return "Saved in this browser. Connect cloud delivery to send queued changes.";
  }
  const active = client;
  try {
    await workspaceStore.deliver(async (commit) => {
      await deliverQueue(
        () => {
          return workspaceStore.getSnapshot().data;
        },
        commit,
        active,
      );
    });
    suspended = false;
    workspaceStore.setConnection(
      "YouTrack delivery connected for this session",
    );
    return "Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.";
  } catch (error) {
    suspended = true;
    throw error;
  }
};
export const automaticDelivery = () => {
  const state = workspaceStore.getSnapshot();
  if (
    !client ||
    hasTaskTextEditing() ||
    suspended ||
    state.error ||
    state.updating ||
    state.delivering ||
    !cloudData(state.data).autoSync ||
    (!state.data.operations.length &&
      !cloudData(state.data).rollupPending &&
      !cloudData(state.data).sharedStatuses)
  )
    return;
  const failed = (error: unknown) => {
    return workspaceStore.setConnection(
      "Automatic delivery paused: " +
        (error instanceof Error
          ? error.message
          : "Cloud delivery needs review"),
    );
  };
  void saveDelivery(true).catch(failed);
};
export const requireDelivery = () => {
  if (!client)
    throw Error(
      "Reconnect delivery with the bound account before reviewing cloud results.",
    );
  return client;
};
