import { cloudData } from "@/cloud/types";
import { indexTree, materialize } from "@/domain/accepted/core.mjs";
import { DetailNavigation } from "@/domain/accepted/detail-navigation.mjs";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { DetailNavigationContext } from "./detail-navigation-context";
import { useSelectionWork } from "./use-selection-work";
import { useWorkspace } from "./use-workspace";
import { useWorkSelection } from "./work-selection-context";
const DetailNavigationProvider = ({ children }: PropsWithChildren) => {
  const navigationRef = useRef(new DetailNavigation());
  const [previous, setPrevious] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "comments">("notes");
  const [focusNotes, setFocusNotes] = useState<{ id: string } | null>(null);
  const work = useSelectionWork(),
    selection = useWorkSelection(),
    state = useWorkspace();
  useEffect(() => {
    navigationRef.current.reset();
    setPrevious(null);
  }, [state.data.view.scope]);
  const tree = () => {
    const { data } = workspaceStore.getSnapshot();
    return indexTree(materialize(data.remote, data.operations), data.order);
  };
  useEffect(() => {
    if (!state.data.view.selected) navigationRef.current.reset();
    const mapping: Record<string, string> = {};
    for (const record of Object.values(cloudData(state.data).records)) {
      if (
        record.status === "confirmed" &&
        record.archivedOperation?.type === "create" &&
        record.remoteId
      )
        mapping[record.archivedOperation.issueId] = record.remoteId;
    }
    navigationRef.current.remap(mapping);
    setPrevious(navigationRef.current.destination(tree().byId));
    if (focusNotes && focusNotes.id !== state.data.view.selected)
      setFocusNotes(null);
  }, [state.data, focusNotes]);
  const open = (id: string, child = false, notes = false) => {
    work.run(async () => {
      await flushDraftEditors();
      const prior = workspaceStore.getSnapshot().data.view.selected;
      if (!tree().byId.has(id)) throw Error("This item no longer exists.");
      await workspaceStore.change((data) => {
        data.view.selected = id;
        if (data.view.detailsMode === "collapsed")
          data.view.detailsMode = "default";
      });
      navigationRef.current.open(prior, id, child);
      setPrevious(navigationRef.current.destination(tree().byId));
      selection.clear();
      setFocusNotes(null);
      if (notes) {
        setTab("notes");
        setFocusNotes({ id });
      }
      await workspaceStore.flush();
    });
  };
  const back = () => {
    work.run(async () => {
      await flushDraftEditors();
      const id = navigationRef.current.destination(tree().byId);
      if (!id) {
        setPrevious(null);
        return;
      }
      await workspaceStore.change((data) => {
        data.view.selected = id;
      });
      setFocusNotes(null);
      navigationRef.current.back(tree().byId);
      setPrevious(navigationRef.current.destination(tree().byId));
      selection.clear();
      await workspaceStore.flush();
    });
  };
  return (
    <DetailNavigationContext
      value={{ tab, setTab, focusNotes, open, previous, back }}
    >
      {children}
      {work.message && <p role="alert">{work.message}</p>}
    </DetailNavigationContext>
  );
};
export default DetailNavigationProvider;
