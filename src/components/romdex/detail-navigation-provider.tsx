import { cloudData } from "@/cloud/types";
import { DetailNavigation } from "@/domain/accepted/detail-navigation.mjs";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceItems, workspaceTree } from "@/domain/workspace-derived";
import { workspaceStore } from "@/domain/workspace-store";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { DetailNavigationContext } from "./detail-navigation-context";
import { selectDetailView } from "./detail-navigation-presentation";
import { useSelectionWork } from "./use-selection-work";
import { useStableCallback } from "./use-stable-callback";
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
    return workspaceTree(workspaceItems(data), data.order);
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
  const open = useStableCallback<[string, boolean?, boolean?], void>(
    (id, child = false, notes = false) => {
      work.run(async () => {
        await flushDraftEditors();
        const prior = workspaceStore.getSnapshot().data.view.selected;
        if (!tree().byId.has(id)) throw Error("This item no longer exists.");
        let canFocusNotes = false;
        await workspaceStore.change((data) => {
          canFocusNotes = selectDetailView(data.view, id, notes);
        });
        navigationRef.current.open(prior, id, child);
        setPrevious(navigationRef.current.destination(tree().byId));
        selection.clear();
        setFocusNotes(null);
        if (notes) {
          setTab("notes");
          if (canFocusNotes) setFocusNotes({ id });
        }
        if (!workspaceStore.getSnapshot().error) await workspaceStore.flush();
      });
    },
  );
  const back = useStableCallback(() => {
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
      if (!workspaceStore.getSnapshot().error) await workspaceStore.flush();
    });
  });
  const value = useMemo(() => {
    return { tab, setTab, focusNotes, open, previous, back };
  }, [tab, focusNotes, open, previous, back]);
  return (
    <DetailNavigationContext value={value}>
      {children}
      {work.message && <p role="alert">{work.message}</p>}
    </DetailNavigationContext>
  );
};
export default DetailNavigationProvider;
