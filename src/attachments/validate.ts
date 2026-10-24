import { sha256 } from "@/domain/json";
import type {
  Attachment,
  AttachmentOperation,
  StoredUpload,
  UploadFile,
} from "./types";
export const CLOUD_UPLOAD_LIMIT = 10 * 1024 * 1024;
export const requireCloudUploadSize = (size: number) => {
  if (size > CLOUD_UPLOAD_LIMIT)
    throw Error(
      "YouTrack accepts files up to 10 MiB. No upload was sent. Keep the original file.",
    );
};
export const MAX_UPLOAD = 50 * 1024 * 1024,
  MAX_STAGED = 64 * 1024 * 1024;
export const uploadId = (id: unknown): id is string => {
  return typeof id === "string" && /^[-\w]{1,100}$/.test(id);
};
export const validateUploadFile = (file: UploadFile) => {
  if (
    !file ||
    typeof file.name !== "string" ||
    !file.name ||
    file.name.length > 255 ||
    /[\\/\r\n\0]/.test(file.name) ||
    [".", ".."].includes(file.name) ||
    !Number.isSafeInteger(file.size) ||
    file.size < 0 ||
    file.size > MAX_UPLOAD ||
    typeof file.mimeType !== "string" ||
    !/^[\w.+-]+\/[\w.+-]+$/.test(file.mimeType) ||
    typeof file.hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(file.hash)
  )
    throw Error(
      "Invalid queued file. Use a filename without paths and a file no larger than 50 MiB.",
    );
};
export const validateAttachment = (file: Attachment) => {
  if (
    !file ||
    !uploadId(file.id) ||
    typeof file.name !== "string" ||
    !Number.isSafeInteger(file.size) ||
    file.size < 0 ||
    typeof file.mimeType !== "string" ||
    typeof file.authorId !== "string" ||
    !Number.isFinite(file.created) ||
    !Number.isFinite(file.updated)
  )
    throw Error("Invalid attachment metadata.");
};
export const validateAttachmentOperation = (operation: AttachmentOperation) => {
  if (operation.type === "attachment") {
    validateUploadFile(operation.file);
    if (!uploadId(operation.uploadId) || operation.uploadId !== operation.opId)
      throw Error("Invalid queued upload identity.");
  } else {
    validateAttachment(operation.base);
    if (
      !/^PMON-\d+$/.test(operation.issueId) ||
      operation.attachmentId !== operation.base.id
    )
      throw Error("Invalid queued attachment deletion.");
  }
};
export const verifyUpload = async (value: StoredUpload) => {
  if (!uploadId(value.id)) throw Error("Invalid upload identity.");
  validateUploadFile(value.file);
  if (
    !(value.blob instanceof Blob) ||
    value.blob.size !== value.file.size ||
    (await sha256(new Uint8Array(await value.blob.arrayBuffer()))) !==
      value.file.hash
  )
    throw Error(
      "Queued file bytes failed verification. Restore the original file before delivery.",
    );
  return value;
};
export const sameAttachment = (a: Attachment, b: Attachment) => {
  return [
    "id",
    "name",
    "size",
    "mimeType",
    "created",
    "updated",
    "authorId",
  ].every((key) => {
    return Reflect.get(a, key) === Reflect.get(b, key);
  });
};
export const stagedFile = async (
  id: string,
  file: File,
  expected?: UploadFile,
): Promise<StoredUpload> => {
  if (!expected) requireCloudUploadSize(file.size);
  if (file.size > MAX_UPLOAD)
    throw Error("Choose a file no larger than 50 MiB.");
  const hash = await sha256(new Uint8Array(await file.arrayBuffer())),
    metadata = expected ?? {
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      hash,
    };
  validateUploadFile(metadata);
  if (metadata.size !== file.size || metadata.hash !== hash)
    throw Error(
      "These bytes do not match the queued file. The queued operation is unchanged.",
    );
  return { id, file: metadata, blob: file };
};

export const sameUploadFile = (a: UploadFile, b: UploadFile) => {
  return (
    a.name === b.name &&
    a.size === b.size &&
    a.mimeType === b.mimeType &&
    a.hash === b.hash
  );
};
