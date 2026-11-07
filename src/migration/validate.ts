import { jsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { validateNpcdexDrafts } from "@/npcdex/model";
import { validateEditorRecovery } from "@/npcdex/recovery";
import { validateNpcdex } from "@/npcdex/validate";
import { IMAGE_DATA_URL, IMAGE_REF } from "@/storage/image-storage";
import { validateRdxFiles } from "@/rdx/library";
export const validateMigration = (data: WorkspaceData) => {
  validateRdxFiles(data);
  validateEditorRecovery(data);
  if (
    data.images &&
    Object.entries(data.images).some(([id, value]) => {
      return (
        !/^(PMON-[1-9]\d*|local-[A-Za-z0-9-]+)$/.test(id) ||
        typeof value !== "string" ||
        !(IMAGE_REF.test(value) || IMAGE_DATA_URL.test(value))
      );
    })
  )
    throw Error("Invalid saved task image.");
  if (data.npcdex) validateNpcdex(data.npcdex);
  validateNpcdexDrafts(data);
  const { migration } = data;
  if (migration) {
    if (
      migration.archive?.format !== "ROMDexDesktopExport/1" ||
      !Array.isArray(migration.archive.files) ||
      !Array.isArray(migration.pending) ||
      !Array.isArray(migration.reviewed) ||
      typeof migration.importedAt !== "string"
    )
      throw Error("Invalid desktop migration recovery record.");
    jsonObject(migration.previousBrowser);
  }
};
