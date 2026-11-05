import { cloudData } from "@/cloud/types";
import { guardTicketChanges, reviewedTicketIds } from "./ticket-locks";
import type { WorkspaceData } from "./types";
export const needsDeliveryReview = (data: WorkspaceData) => {
  return Object.values(cloudData(data).records).some((record) => {
    return record.status !== "confirmed";
  });
};
export const guardReviewBrowsing = (
  before: WorkspaceData,
  after: WorkspaceData,
) => {
  const cloud = { ...cloudData(after), autoSync: cloudData(before).autoSync };
  const account = cloudData(before).accountId;
  if (account === undefined) delete cloud.accountId;
  else cloud.accountId = account;
  guardTicketChanges(
    { ...before, cloud: cloudData(before) },
    { ...after, cloud },
    reviewedTicketIds(before),
    true,
  );
};

export const reviewNotice = (data: WorkspaceData) => {
  return Object.values(cloudData(data).records).some((record) => {
    return record.status !== "confirmed" && record.status !== "ready";
  })
    ? "Cloud delivery needs review."
    : "Reviewed changes are queued for delivery.";
};
