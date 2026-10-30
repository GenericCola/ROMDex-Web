import { tagIds } from "@/cloud/tag-types";
import type { WorkspaceData } from "./types";
export const applyTaskTagBaseline = (
  data: WorkspaceData,
  issueId: string,
  ids: string[],
  choices: { id: string; name: string }[],
) => {
  const item = data.remote.find((entry) => {
    return entry.id === issueId;
  });
  if (!item) throw Error("The task changed while tags were being read.");
  const tags = tagIds(ids);
  const labels = new Map(
    [...(item.tagNames ?? []), ...choices].map((tag) => {
      return [tag.id, tag.name];
    }),
  );
  item.tags = tags;
  item.tagNames = tags.map((id) => {
    return { id, name: labels.get(id) ?? id };
  });
  // Pending operations and their original three-way bases are deliberately untouched.
};
