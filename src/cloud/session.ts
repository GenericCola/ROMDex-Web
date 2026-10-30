import { ResumeRejected } from "@/auth/resume-failure";
import { authRequestGuard } from "@/auth/session";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { hasTaskComposition } from "@/domain/task-editing";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { deliverQueue } from "./delivery";
import { DeliveryInputsChanged } from "./delivery-inputs";
import { HierarchyQuarantine } from "./hierarchy-quarantine";
import { cloudData } from "./types";
const hierarchyQuarantine = new HierarchyQuarantine();
let client: DeliveryClient | null = null;
let suspended = false;
let connectionGeneration = 0;
export const connectDelivery = async (
  token: string,
  expectedUserId?: string,
) => {
  hierarchyQuarantine.assertConnectionAllowed();
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
  suspended = hierarchyQuarantine.capture(workspaceStore.getSnapshot().data);
  client = next;
  workspaceStore.setConnection(
    hierarchyQuarantine.message(workspaceStore.getSnapshot().data, suspended),
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
  hierarchyQuarantine.assertSafe(workspaceStore.getSnapshot().data);
  await flushDraftEditors();
  if (
    automatic &&
    (hasTaskComposition() ||
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
        undefined,
        () => {
          return (
            !automatic || cloudData(workspaceStore.getSnapshot().data).autoSync
          );
        },
      );
    });
    suspended = false;
    workspaceStore.setConnection(
      "YouTrack delivery connected for this session",
    );
    return workspaceStore.getSnapshot().data.operations.length
      ? "Current delivery finished. Additional changes remain safely queued."
      : "Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.";
  } catch (error) {
    if (error instanceof DeliveryInputsChanged) {
      suspended = false;
      return error.message;
    }
    suspended = true;
    throw error;
  }
};
export const automaticDelivery = () => {
  const state = workspaceStore.getSnapshot();
  if (
    !client ||
    hasTaskComposition() ||
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
  return saveDelivery(true).catch(failed);
};
export const requireDelivery = () => {
  hierarchyQuarantine.assertConnectionAllowed();
  if (!client)
    throw Error(
      "Reconnect delivery with the bound account before reviewing cloud results.",
    );
  return client;
};
