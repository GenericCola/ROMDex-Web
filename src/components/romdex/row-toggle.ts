import { workspaceStore } from "@/domain/workspace-store";
export const toggleExpanded = (id: string, expanded: boolean) => {
  void workspaceStore.change((next) => {
    next.view.expanded = expanded
      ? next.view.expanded.filter((entry) => {
          return entry !== id;
        })
      : [...next.view.expanded, id];
  });
};
