import { authRequestGuard } from "@/auth/session";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { automaticBatch } from "./automatic-batch";
import { DeletionReviewRequired } from "./deletion-isolation";
import { deliverQueue } from "./delivery";
import { reportDeliveryFailure } from "./delivery-failure";
import { isDeferredDelivery } from "./delivery-inputs";
import { HierarchyQuarantine } from "./hierarchy-quarantine";
import { openDelivery } from "./open-delivery";
import { uploadReadbackDue } from "./reconcile-uploads";
import { OperationReviewRequired } from "./review-isolation";
import { finishLocalSave, saveLocalDrafts } from "./save-local-drafts";
import {
  resumeDeletionReadback,
  resumeUploadReadback,
} from "./session-deletions";
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
  const next = await openDelivery(token, expectedUserId, assertCurrent);
  await resumeDeletionReadback(next, assertCurrent);
  await resumeUploadReadback(next);
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
export const uploadRecoveryDue = () => {
  return (
    !!client && uploadReadbackDue(workspaceStore.getSnapshot().data, client)
  );
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
  const active = client;
  await resumeUploadReadback(active);
  const selected = automatic
    ? automaticBatch(workspaceStore.getSnapshot().data)
    : undefined;
  if (selected && !selected.size)
    return "Saved in this browser. Some changes need review or are still being edited.";
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
    if (
      error instanceof OperationReviewRequired ||
      error instanceof DeletionReviewRequired ||
      isDeferredDelivery(error)
    ) {
      suspended = false;
      workspaceStore.setConnection(error.message);
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
