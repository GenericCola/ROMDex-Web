import { cloudData } from "@/cloud/types";
import type { WorkspaceData } from "@/domain/types";
import type { StoredUpload, UploadStore } from "./types";
import { sameUploadFile, uploadId, validateUploadFile } from "./validate";
export const archivedUploadCandidates = async (
  data: WorkspaceData,
  storage: UploadStore,
) => {
  const active = new Set(
      data.operations.flatMap((op) => {
        return op.type === "attachment" ? [op.uploadId] : [];
      }),
    ),
    seen = new Set<string>(),
    files: (StoredUpload & { issueId: string })[] = [];
  for (const record of Object.values(cloudData(data).records)) {
    const op = record.archivedOperation;
    if (
      record.status !== "confirmed" ||
      op?.type !== "attachment" ||
      active.has(op.uploadId) ||
      seen.has(op.uploadId)
    )
      continue;
    if (!uploadId(op.uploadId) || op.uploadId !== op.opId)
      throw Error("Invalid archived upload identity.");
    validateUploadFile(op.file);
    seen.add(op.uploadId);
    const value = await storage.get(op.uploadId);
    if (!value) continue;
    if (!sameUploadFile(value.file, op.file))
      throw Error(
        "Archived staged metadata differs. Keep recovery before changing the cache.",
      );
    files.push({ ...value, issueId: op.issueId });
  }
  return files;
};
export const checkCacheRemoval = (
  data: WorkspaceData,
  files: (StoredUpload & { issueId: string })[],
) => {
  if (
    Object.values(cloudData(data).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    throw Error(
      "Review pending delivery before removing archived staged copies.",
    );
  for (const file of files) {
    if (
      data.operations.some((op) => {
        return op.type === "attachment" && op.uploadId === file.id;
      })
    )
      throw Error("An active upload still needs these bytes.");
    const op = cloudData(data).records[file.id]?.archivedOperation;
    if (op?.type !== "attachment" || !sameUploadFile(op.file, file.file))
      throw Error("Archived upload evidence changed. Review the list again.");
  }
};
