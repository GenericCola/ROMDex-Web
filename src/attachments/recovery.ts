import { cloudData } from "@/cloud/types";
import { base64Bytes, encodeBytes } from "@/domain/bytes";
import type { JsonObject, JsonValue } from "@/domain/json";
import { jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { uploadStorage } from "@/storage/upload-storage";
import type { StoredUpload, UploadFile, UploadStore } from "./types";
import {
  MAX_STAGED,
  sameUploadFile,
  uploadId,
  validateUploadFile,
  verifyUpload,
} from "./validate";
export const uploadReferences = (data: WorkspaceData) => {
  const refs = new Map<string, UploadFile>();
  for (const op of [
    ...data.operations,
    ...Object.values(cloudData(data).records).flatMap((record) => {
      return record.archivedOperation ? [record.archivedOperation] : [];
    }),
  ])
    if (op.type === "attachment") {
      validateUploadFile(op.file);
      const previous = refs.get(op.uploadId);
      if (previous && !sameUploadFile(previous, op.file))
        throw Error("Conflicting staged file identities.");
      refs.set(op.uploadId, op.file);
    }
  return refs;
};
export const recoveryWithUploads = async (
  text: string,
  storage: UploadStore = uploadStorage,
) => {
  const root = jsonObject(parseJson(text, 512 * 1024 * 1024)),
    data = root.data as unknown as WorkspaceData,
    uploads: JsonObject[] = [],
    missing: string[] = [];
  try {
    let total = 0;
    for (const [id, file] of uploadReferences(data)) {
      const value = await storage.get(id);
      if (!value) {
        if (
          data.operations.some((op) => {
            return op.type === "attachment" && op.uploadId === id;
          })
        )
          missing.push(id);
        continue;
      }
      if (!sameUploadFile(file, value.file))
        throw Error("A staged file's metadata differs.");
      total += file.size;
      if (total > MAX_STAGED) throw Error("Staged recovery exceeds 64 MiB.");
      uploads.push({
        id,
        file: { ...file },
        data: encodeBytes(new Uint8Array(await value.blob.arrayBuffer())),
      });
    }
  } catch (error) {
    root.uploadRecoveryError =
      error instanceof Error
        ? error.message
        : "Some staged files could not be exported. Keep their originals.";
  }
  root.uploads = uploads;
  root.missingUploads = missing;
  return JSON.stringify(root, null, 2);
};
export const readRecoveryUploads = async (
  value: JsonValue | undefined,
  data: WorkspaceData,
) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000)
    throw Error("Invalid recovery upload inventory.");
  const refs = uploadReferences(data),
    seen = new Set<string>(),
    files: StoredUpload[] = [];
  let total = 0;
  for (const entry of value) {
    const item = jsonObject(entry),
      file = jsonObject(item.file) as unknown as UploadFile;
    if (
      !uploadId(item.id) ||
      seen.has(item.id) ||
      typeof item.data !== "string"
    )
      throw Error("Invalid recovered upload.");
    seen.add(item.id);
    validateUploadFile(file);
    const expected = refs.get(item.id);
    if (!expected || !sameUploadFile(expected, file))
      throw Error(
        "Recovered file metadata does not match its queued or archived operation.",
      );
    total += file.size;
    if (total > MAX_STAGED) throw Error("Recovered file bytes exceed 64 MiB.");
    const bytes = base64Bytes(item.data);
    files.push(
      await verifyUpload({
        id: item.id,
        file,
        blob: new Blob([Uint8Array.from(bytes)], { type: file.mimeType }),
      }),
    );
  }
  return files;
};
export const stageRecoveryUploads = async (
  files: StoredUpload[],
  storage: UploadStore = uploadStorage,
) => {
  for (const file of files) await storage.put(file);
};
