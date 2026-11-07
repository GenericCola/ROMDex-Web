import { imageRefOf, imageUrl } from "@/storage/image-storage";
import { editTask } from "./task-actions";
import type { WorkspaceData } from "./types";
import { findWorkspaceItem } from "./workspace-item";

export interface TileDraft {
  id: string;
  baseSummary: string;
  baseImage: string | null;
  name: string;
  image: string | null;
}
export const applyTileSettings = (data: WorkspaceData, draft: TileDraft) => {
  const item = findWorkspaceItem(data, draft.id);
  if (!item) throw Error("The item no longer exists.");
  if (
    item.summary !== draft.baseSummary ||
    imageUrl(data.images?.[draft.id]) !== draft.baseImage
  )
    throw Error(
      "Tile settings changed. Close and reopen this dialog before applying.",
    );
  const label = draft.name.trim();
  if (!label) throw Error("Enter an item name.");
  const summary = (/^\[Epic\]\s*/.exec(item.summary)?.[0] ?? "") + label;
  if (summary !== item.summary) editTask(data, item.id, { summary });
  if (draft.image !== draft.baseImage) {
    data.images ??= {};
    if (draft.image) data.images[item.id] = imageRefOf(draft.image);
    else delete data.images[item.id];
  }
};
