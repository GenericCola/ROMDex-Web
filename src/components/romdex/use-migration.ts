import {
  readRecoveryUploads,
  stageRecoveryUploads,
} from "@/attachments/recovery";
import type { StoredUpload } from "@/attachments/types";
import { disconnectDelivery } from "@/cloud/session";
import { flushDraftEditors } from "@/domain/editor-drafts";
import { jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { validateWorkspace } from "@/domain/workspace-data";
import { workspaceStore } from "@/domain/workspace-store";
import type { DesktopPreview } from "@/migration/desktop";
import { applyDesktop, previewDesktop } from "@/migration/desktop";
import { readDesktopExport } from "@/migration/desktop-export";
import { readMigrationText } from "@/migration/file-text";
import { verifyRetainedAssets } from "@/migration/verify-assets";
import type { ChangeEvent } from "react";
import { useState } from "react";
export const useMigration = (close: () => void) => {
  const [uploads, setUploads] = useState<StoredUpload[]>([]);
  const [preview, setPreview] = useState<DesktopPreview | null>(null);
  const [recovery, setRecovery] = useState<WorkspaceData | null>(null);
  const [baseline, setBaseline] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async (file: File) => {
    setBusy(true);
    setPreview(null);
    setRecovery(null);
    setUploads([]);
    setChoices([]);
    setConfirmed(false);
    setMessage("");
    try {
      if (file.size > 512 * 1024 * 1024)
        throw Error("The selected file exceeds 512 MiB.");
      await flushDraftEditors();
      await workspaceStore.flush();
      const content = await readMigrationText(file),
        current = workspaceStore.getSnapshot().data;
      const value = jsonObject(parseJson(content, 512 * 1024 * 1024));
      if (value.format === "ROMDexWebRecovery/1") {
        const data = validateWorkspace(value.data);
        await verifyRetainedAssets(data);
        setUploads(await readRecoveryUploads(value.uploads, data));
        setRecovery(data);
        setBaseline(JSON.stringify(current));
      } else
        setPreview(previewDesktop(await readDesktopExport(content), current));
      setMessage("File verified locally. No cloud request was made.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The file could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  };
  const select = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void load(file);
    event.target.value = "";
  };
  const toggle = (event: ChangeEvent<HTMLInputElement>) => {
    setConfirmed(event.target.checked);
  };
  const apply = async () => {
    if (!confirmed) return;
    setBusy(true);
    try {
      disconnectDelivery();
      await stageRecoveryUploads(uploads);
      await workspaceStore.change((data) => {
        if (preview) applyDesktop(data, preview, new Set(choices));
        else if (recovery) {
          if (JSON.stringify(data) !== baseline)
            throw Error(
              "The workspace changed after preview. Select the recovery file again.",
            );
          const original = structuredClone(data),
            restored = structuredClone(recovery);
          restored.cloud = {
            ...restored.cloud,
            records: restored.cloud?.records ?? {},
            autoSync: false,
          };
          if (restored.migration)
            restored.migration.previousBrowser = jsonObject(
              parseJson(JSON.stringify(original)),
            );
          for (const key of Object.keys(data))
            Reflect.deleteProperty(data, key);
          Object.assign(data, restored);
        }
      });
      await workspaceStore.flush();
      close();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Import did not complete. Keep the source file.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    void apply();
  };
  const choose = (id: string, selected: boolean) => {
    setChoices((previous) => {
      return selected
        ? [...previous, id]
        : previous.filter((value) => {
            return value !== id;
          });
    });
  };
  return {
    preview,
    recovery,
    uploads,
    missingUploads:
      recovery?.operations.filter((op) => {
        return (
          op.type === "attachment" &&
          !uploads.some((file) => {
            return file.id === op.uploadId;
          })
        );
      }).length ?? 0,
    choices,
    confirmed,
    busy,
    message,
    select,
    toggle,
    submit,
    choose,
  };
};
