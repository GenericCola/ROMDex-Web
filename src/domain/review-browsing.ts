import { cloudData } from "@/cloud/types";
import type { WorkspaceData } from "./types";
export const needsDeliveryReview = (data: WorkspaceData) => {
  return Object.values(cloudData(data).records).some((record) => {
    return record.status !== "confirmed";
  });
};
const protectedData = (data: WorkspaceData) => {
  return JSON.stringify({
    ...data,
    view: null,
    cloud: { ...cloudData(data), autoSync: null, accountId: null },
  });
};
export const guardReviewBrowsing = (
  before: WorkspaceData,
  after: WorkspaceData,
) => {
  if (
    needsDeliveryReview(before) &&
    protectedData(before) !== protectedData(after)
  )
    throw Error(
      "Cloud delivery needs review. You can browse tasks, but resolve the pending review in Connection Details before editing.",
    );
};

export const reviewNotice = (data: WorkspaceData) => {
  return Object.values(cloudData(data).records).some((record) => {
    return record.status !== "confirmed" && record.status !== "ready";
  })
    ? "Cloud delivery needs review."
    : "Reviewed changes are queued for delivery.";
};
