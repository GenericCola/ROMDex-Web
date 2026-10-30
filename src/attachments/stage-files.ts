import {
  MAX_STAGED,
  requireCloudUploadSize,
  validateUploadFile,
} from "./validate";
export const MAX_STAGE_FILES = 10;
export const validateStageFiles = (files: readonly File[]) => {
  if (!files.length || files.length > MAX_STAGE_FILES)
    throw Error("Choose between 1 and 10 files at once.");
  let total = 0;
  for (const file of files) {
    requireCloudUploadSize(file.size);
    validateUploadFile({
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      hash: "0".repeat(64),
    });
    total += file.size;
  }
  if (total > MAX_STAGED)
    throw Error(
      "This batch exceeds the 64 MiB local file limit. Choose fewer files.",
    );
};
