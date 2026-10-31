import type { WorkspaceData } from "@/domain/types";
import { readFullSnapshot } from "./full-snapshot";
import { availabilityTree } from "./rollup-availability-tree";
import { cloudData, type DeliveryPort } from "./types";
export const readRollupAvailability = async (
  data: WorkspaceData,
  port: DeliveryPort,
) => {
  if (cloudData(data).accountId && cloudData(data).accountId !== port.accountId)
    throw Error("The task read belongs to a different account.");
  // all() completes every page or throws. An authenticated full snapshot is
  // the current visible projection, as in the original desktop implementation.
  const raw = await readFullSnapshot(port);
  const fresh = new Map(
    raw.map((item) => {
      return [item.id, item];
    }),
  );
  const previous = new Map(
    [...(cloudData(data).unavailable?.tasks ?? []), ...data.remote].map(
      (item) => {
        return [item.id, item];
      },
    ),
  );
  return availabilityTree(data, previous, fresh);
};
