import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { deliverQueue } from "./delivery";
import { cloudData } from "./types";
let client: DeliveryClient | null = null;
let suspended = false;
export const connectDelivery = async (token: string) => {
  const next = new DeliveryClient(token);
  await next.connect();
  const bound = cloudData(workspaceStore.getSnapshot().data).accountId;
  if (bound && bound !== next.accountId)
    throw Error("The queue is bound to a different account.");
  await workspaceStore.change((data) => {
    data.cloud = { ...cloudData(data), accountId: next.accountId };
  });
  await workspaceStore.flush();
  client = next;
  suspended = false;
  workspaceStore.setConnection("YouTrack delivery connected for this session");
};
export const disconnectDelivery = () => {
  client = null;
  suspended = true;
  workspaceStore.setConnection("Not connected");
};
export const deliveryConnected = () => {
  return client !== null;
};
export const saveDelivery = async () => {
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
    suspended ||
    state.error ||
    state.updating ||
    state.delivering ||
    !cloudData(state.data).autoSync ||
    (!state.data.operations.length && !cloudData(state.data).rollupPending)
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
  void saveDelivery().catch(failed);
};
export const requireDelivery = () => {
  if (!client)
    throw Error(
      "Reconnect delivery with the bound account before reviewing cloud results.",
    );
  return client;
};
