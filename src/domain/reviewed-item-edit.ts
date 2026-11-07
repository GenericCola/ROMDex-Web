import { equal, supported } from "@/cloud/delivery-helpers";
import { tagIds, validateTagSelection } from "@/cloud/tag-types";
import { nativeEditPayload } from "@/youtrack/native-edit-payload";
import type { JsonObject } from "./json";
import { nativeEditKey } from "./native-edit-fields";
import { editTask } from "./task-actions";
import type { TaskPatch, WorkspaceData } from "./types";
import { findWorkspaceItem } from "./workspace-item";
export const reviewedItemEdit = (
  data: WorkspaceData,
  id: string,
  patch: TaskPatch,
  base: JsonObject,
  options?: JsonObject,
) => {
  if (!supported(patch))
    throw Error(
      "This field needs its web delivery adapter before it can be changed.",
    );
  if (Object.keys(patch).some(nativeEditKey)) {
    if (!options)
      throw Error("This field needs its web delivery adapter configuration.");
    nativeEditPayload(patch, options);
  }
  const item = findWorkspaceItem(data, id);
  if (!item) throw Error("This item no longer exists.");
  if (patch.tags !== undefined)
    validateTagSelection(
      patch.tags,
      item.tags ?? (id.startsWith("local-") ? [] : undefined),
      options?.tags,
    );
  for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
    const current =
      key === "assignedState" ? (item.assignedState ?? item.state) : item[key];
    const unchanged =
      key === "tags"
        ? equal(
            tagIds(current ?? (id.startsWith("local-") ? [] : undefined)),
            tagIds(base[key] ?? (id.startsWith("local-") ? [] : undefined)),
          )
        : equal(current, base[key]);
    if (!unchanged)
      throw Error(
        "The item changed while editing. Keep your draft, then reopen and review.",
      );
  }
  const previous = [...data.operations].reverse().find((operation) => {
    return operation.issueId === id;
  });
  const firstTagEdit =
    patch.tags !== undefined &&
    previous?.type === "edit" &&
    previous.patch.tags === undefined &&
    previous.purpose !== "rollup";
  editTask(data, id, patch);
  if (firstTagEdit && previous?.type === "edit")
    previous.base.tags = tagIds(item.tags);
};
