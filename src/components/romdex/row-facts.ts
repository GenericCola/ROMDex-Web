import { knownAttachmentCount } from "@/attachments/count";
import type { indexTree } from "@/domain/accepted/core.mjs";
import type { TaskItem, WorkspaceData } from "@/domain/types";
// Primitive per-row facts, so an unchanged row keeps equal props and skips rendering.
export const rowFacts = (
  data: WorkspaceData,
  tree: ReturnType<typeof indexTree>,
  scopeDepth: number,
  item: TaskItem,
) => {
  return {
    depth: (tree.depths.get(item.id) ?? 0) - scopeDepth,
    hasChildren: (tree.children.get(item.id) ?? []).length > 0,
    color: tree.colors.get(item.id) ?? "grey",
    expanded: data.view.expanded.includes(item.id),
    selected: data.view.selected === item.id,
    renaming: data.view.renameId === item.id,
    titleDraft: data.titleDrafts[item.id],
    pending: data.operations.some((op) => {
      return op.issueId === item.id;
    }),
    attachmentCount: knownAttachmentCount(data, item.id),
  } as const;
};
