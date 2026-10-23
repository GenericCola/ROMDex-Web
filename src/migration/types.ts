import type { JsonObject, JsonValue } from "@/domain/json";
export interface DesktopFile {
  name: string;
  bytes: number;
  sha256: string;
  data: string;
}
export interface DesktopExport {
  format: "ROMDexDesktopExport/1";
  exportedAt: string;
  files: DesktopFile[];
}
export interface MigrationRecord {
  importedAt: string;
  archive: DesktopExport;
  pending: JsonValue[];
  reviewed: string[];
  previousBrowser: JsonObject;
}
