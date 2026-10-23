import { cloudData } from "@/cloud/types";
import { indexTree } from "@/domain/accepted/core.mjs";
import type { JsonValue } from "@/domain/json";
import { jsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { validateNpcdex } from "@/npcdex/validate";
import { desktopJson } from "./desktop-export";
import { desktopTask, desktopText } from "./desktop-task";
import type { DesktopExport } from "./types";
export interface AssignmentChoice {
  id: string;
  desktop: string;
  browser: string;
  conflict: boolean;
}
export const previewDesktop = (
  archive: DesktopExport,
  current: WorkspaceData,
) => {
  if (current.migration)
    throw Error(
      "A desktop migration is already present. Preserve recovery before importing another source.",
    );
  if (
    current.operations.length ||
    Object.keys(current.titleDrafts).length ||
    Object.values(current.commentDrafts).some((draft) => {
      return !!draft.trim();
    }) ||
    current.newTask ||
    cloudData(current).sharedStatuses ||
    Object.values(cloudData(current).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error(
      "Finish or export current browser work before importing desktop data. Shared-status workspaces require their separate migration preview.",
    );
  const source = jsonObject(desktopJson(archive, "desktop-workspace.json"));
  if (
    source.version !== 1 ||
    !Array.isArray(source.remote) ||
    !Array.isArray(source.operations)
  )
    throw Error("Unsupported desktop workspace.");
  const sourceTasks = source.remote.map(desktopTask);
  indexTree(sourceTasks);
  const remote = current.remote.length ? current.remote : sourceTasks;
  const assignedValue = desktopJson(archive, "assigned-statuses.json"),
    assigned = assignedValue === null ? {} : jsonObject(assignedValue);
  const choices: AssignmentChoice[] = [];
  for (const item of remote) {
    const entry = assigned[item.id];
    if (!entry) continue;
    const record = jsonObject(entry),
      own = desktopText(record.assignedState);
    if (!own) throw Error("Invalid desktop assigned-status record.");
    const baseline = sourceTasks.find((candidate) => {
      return candidate.id === item.id;
    });
    choices.push({
      id: item.id,
      desktop: own,
      browser: item.assignedState ?? item.state,
      conflict:
        (!!current.remote.length &&
          (record.lastState !== item.state ||
            record.lastUpdated !== item.updated ||
            own !== (item.assignedState ?? item.state))) ||
        !baseline,
    });
  }
  const npcdex = desktopJson(archive, "npcdex-current.json");
  if (npcdex !== null) validateNpcdex(jsonObject(npcdex));
  return {
    archive,
    baseline: JSON.stringify(current),
    remote,
    choices,
    source,
    npcdex: npcdex === null ? null : jsonObject(npcdex),
    pending: source.operations,
    towns:
      npcdex === null ? 0 : (jsonObject(npcdex).towns as JsonValue[]).length,
  };
};
export type DesktopPreview = ReturnType<typeof previewDesktop>;
export { applyDesktop } from "./apply-desktop";
