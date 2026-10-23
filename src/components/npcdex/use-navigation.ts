import { flushDraftEditors } from "@/domain/editor-drafts";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { NpcdexTarget } from "@/npcdex/model";
import { emptyNpcdexTarget, preferredGender } from "@/npcdex/position";
import { useState } from "react";
export const useNavigation = (data: WorkspaceData) => {
  const target = data.view.npcdex?.target ?? emptyNpcdexTarget(),
    gender = data.view.npcdex?.gender ?? preferredGender(data.npcdex),
    stage = data.view.npcdex?.stage ?? "";
  const [message, setMessage] = useState("");
  const navigate = async (next: {
    target: NpcdexTarget;
    gender: string;
    stage: string;
  }) => {
    try {
      await flushDraftEditors();
      await workspaceStore.change((data) => {
        data.view.npcdex = next;
      });
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Save the draft before changing selection.",
      );
    }
  };
  const choose = (field: keyof NpcdexTarget, value: string) => {
    const next = { ...target, [field]: value },
      fields: (keyof NpcdexTarget)[] = [
        "town",
        "area",
        "element",
        "point",
        "block",
      ];
    for (const following of fields.slice(fields.indexOf(field) + 1))
      next[following] = "";
    return navigate({ target: next, gender, stage });
  };
  const setGender = (value: string) => {
    void navigate({ target, gender: value, stage });
  };
  const setStage = (value: string) => {
    void navigate({ target, gender, stage: value });
  };
  return {
    target,
    gender,
    stage,
    message,
    document: data.npcdex,
    choose,
    setGender,
    setStage,
  };
};
