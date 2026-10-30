import { cloudData } from "@/cloud/types";
import { guardTicketChanges } from "./ticket-locks";
import type { WorkspaceData } from "./types";
export const guardDeliveryBrowsing = (
  before: WorkspaceData,
  after: WorkspaceData,
  locked: Set<string>,
) => {
  const cloud = { ...cloudData(after), autoSync: cloudData(before).autoSync };
  guardTicketChanges(
    { ...before, cloud: cloudData(before) },
    { ...after, cloud },
    locked,
  );
};
