import { ResumeRejected } from "@/auth/resume-failure";
import { authRequestGuard } from "@/auth/session";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { automaticBatch } from "./automatic-batch";
import { deliverQueue } from "./delivery";
import { reportDeliveryFailure } from "./delivery-failure";
import { isDeferredDelivery } from "./delivery-inputs";
import { HierarchyQuarantine } from "./hierarchy-quarantine";
import { finishLocalSave, saveLocalDrafts } from "./save-local-drafts";
import { resumeDeletionReadback } from "./session-deletions";
import { cloudData } from "./types";
import { deliveryCompletion, statusReadNeeded } from "./unavailable-tasks";
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
    throw Error("Shared status sync requires its safety check to pass.");
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
  await resumeDeletionReadback(next, assertCurrent);
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
  const alreadyDelivering = automatic
    ? workspaceStore.getSnapshot().delivering
    : await saveLocalDrafts();
  if (alreadyDelivering || workspaceStore.getSnapshot().delivering)
    return finishLocalSave();
  if (automatic && !cloudData(workspaceStore.getSnapshot().data).autoSync)
    return "Saved in this browser. Automatic delivery is waiting.";
  if (!client) return finishLocalSave(true);
  const selected = automatic
    ? automaticBatch(workspaceStore.getSnapshot().data)
    : undefined;
  if (selected && !selected.size)
    return "Saved in this browser. Your active edits are waiting.";
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
        selected,
      );
    }, selected);
    suspended = false;
    workspaceStore.setConnection(
      "YouTrack delivery connected for this session",
    );
    return deliveryCompletion(workspaceStore.getSnapshot().data);
  } catch (error) {
    if (isDeferredDelivery(error)) {
      suspended = false;
      return error.message;
    }
    suspended = true;
    reportDeliveryFailure(error);
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
    (!state.data.operations.length &&
      !statusReadNeeded(state.data) &&
      !cloudData(state.data).sharedStatuses)
  )
    return;
  const failed = (error: unknown) => {
    reportDeliveryFailure(error, true);
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
