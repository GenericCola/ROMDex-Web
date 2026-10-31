import { assertIncomingDelta, mergeIncoming } from "@/cloud/incoming-merge";
import { cloudData } from "@/cloud/types";
import type { TaskItem, WorkspaceData, WorkspaceSnapshot } from "./types";
export const persistIncoming = async (
  state: WorkspaceSnapshot,
  switching: boolean,
  write: (update: (data: WorkspaceData) => void) => Promise<void>,
  flush: () => Promise<void>,
  items: TaskItem[],
  held: Set<string>,
  assertCurrent: () => void,
) => {
  if (switching || !state.ready || state.updating || state.error)
    throw Error("The workspace is not ready for incoming updates.");
  assertCurrent();
  const next = structuredClone(state.data);
  if (!mergeIncoming(next, items, held)) return false;
  await write((data) => {
    assertCurrent();
    assertIncomingDelta(data, next);
    data.remote = next.remote;
    data.cloud = cloudData(next);
  });
  await flush();
  return true;
};
