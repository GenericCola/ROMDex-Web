import type { JsonValue } from "@/domain/json";
import { base64Bytes, jsonObject, parseJson, sha256 } from "@/domain/json";
import type { DesktopExport, DesktopFile } from "./types";
const names = [
  "desktop-workspace.json",
  "assigned-statuses.json",
  "npcdex-current.json",
  "npcdex-recovery-draft.json",
  "journal.json",
];
export const readDesktopExport = async (
  text: string,
): Promise<DesktopExport> => {
  const value = jsonObject(parseJson(text, 128 * 1024 * 1024));
  if (
    value.format !== "ROMDexDesktopExport/1" ||
    typeof value.exportedAt !== "string" ||
    !Array.isArray(value.files) ||
    value.files.length > 1000
  )
    throw Error("Unsupported desktop export.");
  const files: DesktopFile[] = [],
    seen = new Set<string>();
  let total = 0;
  for (const entry of value.files) {
    const file = jsonObject(entry);
    if (
      typeof file.name !== "string" ||
      (!names.includes(file.name) &&
        !(
          /^RDX\/(working|previous|recovery)\/[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.rdx$/.test(
            file.name,
          ) && !file.name.includes("..")
        ) &&
        !/^queued-files\/uploads\/[-\w]{1,100}\.(json|bin)$/.test(file.name)) ||
      seen.has(file.name) ||
      typeof file.data !== "string" ||
      typeof file.bytes !== "number" ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw Error(
        "Desktop export contains an unapproved, duplicate or malformed file.",
      );
    seen.add(file.name);
    total += file.bytes;
    if (total > 64 * 1024 * 1024 || file.data.length > 90 * 1024 * 1024)
      throw Error("Desktop export exceeds its verified size limit.");
    const bytes = base64Bytes(file.data);
    if (bytes.length !== file.bytes || (await sha256(bytes)) !== file.sha256)
      throw Error(
        "Desktop export integrity check failed. No browser data changed.",
      );
    files.push({
      name: file.name,
      bytes: file.bytes,
      sha256: file.sha256,
      data: file.data,
    });
  }
  if (!seen.has("desktop-workspace.json"))
    throw Error("The desktop task workspace is missing.");
  return {
    format: "ROMDexDesktopExport/1",
    exportedAt: value.exportedAt,
    files,
  };
};
export const desktopJson = (
  archive: DesktopExport,
  name: string,
): JsonValue => {
  const file = archive.files.find((entry) => {
    return entry.name === name;
  });
  return file
    ? parseJson(
        new TextDecoder("utf-8", { fatal: true }).decode(
          base64Bytes(file.data),
        ),
      )
    : null;
};
