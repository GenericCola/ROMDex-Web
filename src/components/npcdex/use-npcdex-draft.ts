import { registerDraftEditor } from "@/domain/editor-drafts";
import { jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { NpcdexDraft, NpcdexTarget } from "@/npcdex/model";
import { contentRevision, saveNpcdexDraft, targetKey } from "@/npcdex/model";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
export const useNpcdexDraft = (data: WorkspaceData, target: NpcdexTarget) => {
  const key = targetKey(target),
    revision = data.npcdex ? contentRevision(data.npcdex) : "";
  const saved = data.npcdexDrafts?.[key];
  const [draft, setDraft] = useState<NpcdexDraft>(
    saved ?? {
      target,
      sourceRevision: revision,
      note: "",
      intent: "",
      instructions: "",
      proposedText: "",
      flag: "none",
      updatedAt: "",
    },
  );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const savingRef = useRef<Promise<void> | null>(null);
  const save = useCallback(async () => {
    if (savingRef.current) return savingRef.current;
    if (!dirty) return;
    setBusy(true);
    const persist = async () => {
      try {
        await workspaceStore.change((next) => {
          saveNpcdexDraft(next, {
            ...draft,
            updatedAt: new Date().toISOString(),
          });
        });
        await workspaceStore.flush();
        setDirty(false);
        setMessage(
          "Draft saved in this browser. Current content and testing evidence are unchanged.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Draft save failed.",
        );
        throw error;
      } finally {
        setBusy(false);
      }
    };
    savingRef.current = persist();
    try {
      await savingRef.current;
    } finally {
      savingRef.current = null;
    }
  }, [dirty, draft]);
  useEffect(() => {
    if (!dirty)
      setDraft(
        saved ?? {
          target,
          sourceRevision: revision,
          note: "",
          intent: "",
          instructions: "",
          proposedText: "",
          flag: "none",
          updatedAt: "",
        },
      );
  }, [dirty, saved, target, revision]);
  const registration = () => {
    return registerDraftEditor({
      dirty: () => {
        return dirty;
      },
      flush: save,
      capture: () => {
        return {
          id: crypto.randomUUID(),
          kind: "NPCDexDraft",
          draft: jsonObject(parseJson(JSON.stringify(draft))),
        };
      },
    });
  };
  useLayoutEffect(registration, [dirty, save, draft]);
  const edit = (
    field: "note" | "intent" | "instructions" | "proposedText",
    value: string,
  ) => {
    setDraft({ ...draft, [field]: value });
    setDirty(true);
  };
  const submit = () => {
    void save().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Draft save failed.");
    });
  };
  return { draft, dirty, busy, message, edit, submit, setDraft, setDirty };
};
