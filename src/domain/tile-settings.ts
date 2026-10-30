import { materialize } from "./accepted/core.mjs";
import { editTask } from "./task-actions";
import type { WorkspaceData } from "./types";

export interface TileDraft {
  id: string;
  baseSummary: string;
  baseImage: string | null;
  name: string;
  image: string | null;
}
export const applyTileSettings = (data: WorkspaceData, draft: TileDraft) => {
  const item = materialize(data.remote, data.operations).find((candidate) => {
    return candidate.id === draft.id;
  });
  if (!item) throw Error("The item no longer exists.");
  if (
    item.summary !== draft.baseSummary ||
    (data.images?.[draft.id] ?? null) !== draft.baseImage
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
    if (draft.image) data.images[item.id] = draft.image;
    else delete data.images[item.id];
  }
};
