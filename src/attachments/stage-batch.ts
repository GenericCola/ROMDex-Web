import { validateStageFiles } from "./stage-files";
import type { StoredUpload, UploadStore } from "./types";
import { stagedFile } from "./validate";
export const stageFileBatch = async (
  files: File[],
  storage: UploadStore,
  commit: (upload: StoredUpload) => Promise<void>,
) => {
  validateStageFiles(files);
  const staged: string[] = [];
  try {
    for (const file of files) {
      const value = await stagedFile(crypto.randomUUID(), file);
      await storage.put(value);
      await commit(value);
      staged.push(value.id);
    }
  } catch (error) {
    throw Error(
      staged.length +
        " of " +
        files.length +
        " files confirmed staged locally. Keep the originals and review any saving error. " +
        (error instanceof Error ? error.message : "File staging failed."),
      { cause: error },
    );
  }
  return staged;
};
