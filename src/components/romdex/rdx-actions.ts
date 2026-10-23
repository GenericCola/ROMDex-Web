import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { fileBytes, openRdxMap, rdxKey, retainRdx } from "@/rdx/library";
import type { RdxFile, RdxInspection } from "@/rdx/types";
import { runRdx } from "@/rdx/worker-client";
export const saveRdx = async (
  file: RdxFile,
  original: RdxFile,
  value: RdxInspection,
  expected: string | null,
  open: boolean,
) => {
  await flushDraftEditors();
  await workspaceStore.change((data) => {
    retainRdx(data, original, expected);
    const head = data.rdxFiles?.findLast((retained) => {
      return rdxKey(retained) === rdxKey(file);
    });
    retainRdx(data, file, head?.revision ?? null);
    if (open) openRdxMap(data, value);
  });
  await workspaceStore.flush();
};
export const exportRdx = async (file: RdxFile) => {
  const bytes = fileBytes(file),
    checked = await runRdx({ action: "inspect", bytes });
  if (checked.sha256 !== file.sha256)
    throw Error(
      "The stored file failed its checksum. Export recovery and retain the original file.",
    );
  const url = URL.createObjectURL(
      new Blob([Uint8Array.from(bytes)], {
        type: "application/vnd.romdex.rdx",
      }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
