import { cloudData } from "@/cloud/types";
import { materialize } from "@/domain/accepted/core.mjs";
import { tabAction } from "@/domain/accepted/workspace-keyboard.mjs";
import { siblingSelection } from "@/domain/bulk-hierarchy";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { hierarchySignature } from "@/domain/task-drop";
import type { TaskItem } from "@/domain/types";
import {
  toggleSelection,
  type SelectionModifiers,
} from "@/domain/work-selection";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useState, type KeyboardEvent } from "react";
import type { GroupDraft } from "./group-draft-row";
import { useSelectionWork } from "./use-selection-work";
import { useWorkSelection } from "./work-selection-context";
export const useTableSelection = (rows: TaskItem[]) => {
  const selection = useWorkSelection();
  const [group, setGroup] = useState<GroupDraft | null>(null);
  const work = useSelectionWork();
  const visibleKey = JSON.stringify(
    rows.map((item) => {
      return item.id;
    }),
  );
  useEffect(() => {
    const mapping: Record<string, string> = {};
    for (const record of Object.values(
      cloudData(workspaceStore.getSnapshot().data).records,
    )) {
      if (
        record.status === "confirmed" &&
        record.archivedOperation?.type === "create" &&
        record.remoteId
      )
        mapping[record.archivedOperation.issueId] = record.remoteId;
    }
    selection.reconcile(JSON.parse(visibleKey) as string[], mapping);
  }, [visibleKey, selection]);
  const choose = (id: string, modifiers: SelectionModifiers) => {
    if (group || work.busy) return;
    work.run(async () => {
      await flushDraftEditors();
      const visible = rows.map((item) => {
        return item.id;
      });
      const chosen = toggleSelection(
        selection.selection,
        id,
        visible,
        modifiers,
      );
      await workspaceStore.change((next) => {
        if (next.newTask || next.view.renameId)
          throw Error("Finish or Cancel the Current Editor First.");
        next.view.selected =
          chosen.ids.length === 1 ? (chosen.ids[0] ?? null) : null;
      });
      selection.toggle(id, visible, modifiers);
    });
  };
  const closeGroup = () => {
    setGroup(null);
    selection.clear();
    document
      .querySelector<HTMLElement>(".work-trays")
      ?.focus({ preventScroll: true });
  };
  const beginGroup = () => {
    work.run(async () => {
      await flushDraftEditors();
      const current = workspaceStore.getSnapshot().data;
      if (group || current.newTask || current.view.renameId)
        throw Error("Finish or Cancel the Current Editor First.");
      const choice = siblingSelection(
        materialize(current.remote, current.operations),
        current.order,
        selection.selection.ids,
      );
      const first = choice.members[0];
      if (!first) return;
      const absolute = choice.tree.depths.get(first.id) ?? 0;
      const scopeDepth = current.view.scope
        ? (choice.tree.depths.get(current.view.scope) ?? 0) + 1
        : 0;
      setGroup({
        ids: choice.members.map((item) => {
          return item.id;
        }),
        parentId: choice.parentId,
        beforeId: first.id,
        expected: hierarchySignature(current),
        depth: Math.max(0, absolute - scopeDepth),
      });
    });
  };
  useEffect(() => {
    return selection.registerGroup(beginGroup);
  });
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.defaultPrevented ||
      work.busy ||
      (event.target instanceof HTMLElement &&
        event.target.closest(
          "input:not([type=checkbox]),textarea,select,[contenteditable=true],dialog",
        ))
    )
      return;
    const target = event.target as HTMLElement;
    if (
      tabAction({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        modal: !!document.querySelector("dialog[open]"),
        busy: !!group,
        selectedCount: selection.selection.ids.length,
        navigation: target.matches(
          ".row-title,#work-tray,input[type=checkbox]",
        ),
      }) === "group"
    ) {
      event.preventDefault();
      beginGroup();
    }
  };
  return {
    ...selection,
    group,
    closeGroup,
    choose,
    keyDown,
    busy: work.busy,
    message: work.message,
  };
};
