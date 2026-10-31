import {
  exitHierarchyRecovery,
  readHierarchyRecovery,
  repairHierarchyRecovery,
} from "@/cloud/hierarchy-recovery";
import { useEffect, useRef, useState } from "react";
type HierarchyPreview = Awaited<ReturnType<typeof readHierarchyRecovery>>;
export const useHierarchyRecovery = () => {
  const [preview, setPreview] = useState<HierarchyPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const generationRef = useRef(0),
    applyingRef = useRef(false);
  useEffect(() => {
    return () => {
      generationRef.current = -1;
    };
  }, []);
  const failed = (error: unknown) => {
    setMessage(
      error instanceof Error
        ? error.message
        : "Hierarchy recovery could not finish. Keep recovery protections enabled.",
    );
  };
  const read = async () => {
    if (applyingRef.current) return;
    const run = ++generationRef.current;
    setBusy(true);
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    setMessage(
      "Reading current parent relationships from YouTrack. This preview does not write to YouTrack.",
    );
    try {
      const result = await readHierarchyRecovery();
      if (generationRef.current !== run) return;
      setPreview(result);
      setMessage(
        "Preview only. Nothing is selected automatically. Choose only the pending parent changes you want to discard.",
      );
    } catch (error) {
      if (generationRef.current === run) failed(error);
    } finally {
      if (generationRef.current === run) setBusy(false);
    }
  };
  const toggle = (id: string, checked: boolean) => {
    if (busy) return;
    setSelected((prior) => {
      return checked
        ? [...new Set([...prior, id])]
        : prior.filter((value) => {
            return value !== id;
          });
    });
    setConfirmed(false);
  };
  const apply = async () => {
    if (
      !preview ||
      !selected.length ||
      !confirmed ||
      busy ||
      applyingRef.current
    )
      return;
    applyingRef.current = true;
    setApplying(true);
    setBusy(true);
    try {
      await repairHierarchyRecovery(preview, selected);
      setPreview(null);
      setSelected([]);
      setConfirmed(false);
      setMessage(
        "Selected parent relationships repaired locally. Other fields and unrelated queued work were preserved. Recovery protections remain enabled.",
      );
    } catch (error) {
      failed(error);
    } finally {
      applyingRef.current = false;
      setApplying(false);
      setBusy(false);
    }
  };
  const exit = async () => {
    if (busy || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setBusy(true);
    setMessage(
      "Checking fresh hierarchy and unresolved delivery outcomes before leaving recovery. No queued work will be sent.",
    );
    try {
      await exitHierarchyRecovery();
    } catch (error) {
      failed(error);
    } finally {
      applyingRef.current = false;
      setApplying(false);
      setBusy(false);
    }
  };
  const cancel = () => {
    if (applyingRef.current) return;
    generationRef.current++;
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    setBusy(false);
    setMessage("Preview closed. Recovery protections remain enabled.");
  };
  return {
    preview,
    selected,
    confirmed,
    setConfirmed,
    busy,
    applying,
    message,
    read,
    toggle,
    apply,
    cancel,
    exit,
  };
};
