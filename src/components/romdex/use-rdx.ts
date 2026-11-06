import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { fileBytes, rdxFile, rdxKey } from "@/rdx/library";
import type { RdxFile, RdxInspection } from "@/rdx/types";
import { runRdx } from "@/rdx/worker-client";
import { useEffect, useRef, useState } from "react";
import { exportRdx, saveRdx } from "./rdx-actions";
import { useRdxOperation } from "./use-rdx-operation";
export const useRdx = () => {
  const [value, setValue] = useState<RdxInspection | null>(null),
    [name, setName] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [choices, setChoices] = useState<Record<string, string>>({});
  const { busy, label, message, setMessage, run } = useRdxOperation();
  const controllerRef = useRef<AbortController | null>(null),
    sourceRef = useRef<Uint8Array | null>(null),
    localRef = useRef<RdxFile | null>(null),
    baselineRef = useRef<string | null>(null),
    originalRef = useRef<RdxFile | null>(null);
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);
  const start = () => {
    controllerRef.current?.abort();
    const active = new AbortController();
    controllerRef.current = active;
    return active;
  };
  const verified = (result: RdxInspection) => {
    setValue(result);
    setMessage("RDX verified locally. No YouTrack changes were queued.");
  };
  const load = async (bytes: Uint8Array, fileName: string, merge = true) => {
    const active = start();
    setValue(null);
    setName(fileName);
    setConfirmed(false);
    setChoices({});
    sourceRef.current = bytes;
    await flushDraftEditors();
    await workspaceStore.flush();
    const initial = await runRdx({ action: "inspect", bytes }, active.signal);
    if (active.signal.aborted) return;
    originalRef.current = rdxFile(fileName, initial);
    const head =
      workspaceStore.getSnapshot().data.rdxFiles?.findLast((file) => {
        return (
          rdxKey(file) ===
          rdxKey({
            datasetId: initial.document.datasetId,
            documentId: initial.document.documentId,
          })
        );
      }) ?? null;
    localRef.current = head;
    baselineRef.current = head?.revision ?? null;
    const result =
      merge && head && head.revision !== initial.document.revision
        ? await runRdx(
            { action: "merge", bytes, local: fileBytes(head), choices: {} },
            active.signal,
          )
        : initial;
    if (!active.signal.aborted) verified(result);
  };
  const select = (file: File) => {
    return run("Validating RDX file…", async () => {
      setValue(null);
      if (file.size > 64 * 1024 * 1024)
        throw Error("Choose an RDX file no larger than 64 MiB.");
      await load(new Uint8Array(await file.arrayBuffer()), file.name);
    });
  };
  const choose = (id: string, choice: string) => {
    const next = { ...choices };
    if (choice) next[id] = choice;
    else delete next[id];
    setChoices(next);
    setConfirmed(false);
    const bytes = sourceRef.current,
      local = localRef.current;
    if (!bytes || !local) return;
    void run("Merging RDX choices…", async () => {
      const active = start();
      const result = await runRdx(
        { action: "merge", bytes, local: fileBytes(local), choices: next },
        active.signal,
      );
      if (!active.signal.aborted) verified(result);
    });
  };
  const save = (open = false) => {
    return run("Saving RDX…", async () => {
      if (!value || !confirmed || !originalRef.current) return;
      await saveRdx(
        rdxFile(name, value),
        originalRef.current,
        value,
        baselineRef.current,
        open,
      );
      baselineRef.current = value.document.revision as string;
      setConfirmed(false);
      setMessage(
        open
          ? "Map opened. The preceding NPCDex workspace and drafts are retained in recovery history."
          : "RDX saved in this browser. Export a recovery copy for backup.",
      );
    });
  };
  const openFile = (file: RdxFile) => {
    void run("Validating RDX file…", async () => {
      await load(fileBytes(file), file.name, false);
    });
  };
  const download = (file: RdxFile) => {
    return run("Exporting RDX…", async () => {
      await exportRdx(file);
    });
  };
  return {
    value,
    name,
    message,
    busy,
    label,
    confirmed,
    setConfirmed,
    choices,
    select,
    choose,
    save,
    openFile,
    download,
  };
};
