import { indexTree, STATES, youTrackState } from "@/domain/accepted/core.mjs";
import type { WorkspaceData } from "@/domain/types";
import { reviewStatusBlocks } from "./review-isolation";
import { cloudData } from "./types";
export const unblockedStatusWork = (data: WorkspaceData) => {
  const missing = new Set(cloudData(data).unavailable?.missingIds ?? []);
  const items = data.remote.filter((item) => {
    return !missing.has(item.id);
  });
  const tree = indexTree(items),
    blocked = reviewStatusBlocks(data, items);
  return items.some((item) => {
    if (blocked.has(item.id)) return false;
    const color = tree.colors.get(item.id);
    const desired =
      tree.children.get(item.id)?.length && color
        ? youTrackState(STATES[color])
        : youTrackState(item.assignedState ?? item.state);
    return item.state !== desired;
  });
};
