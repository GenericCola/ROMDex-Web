export type StoreName = "romdex-metadata" | "npcdex";
export type PartCodec = "gzip-json" | "raw";

export const MANIFEST_FORMAT = "romdex-store";
export const MANIFEST_VERSION = 1;
export const STORE_TITLES: Record<StoreName, string> = {
  "romdex-metadata": "ROMDex data",
  npcdex: "NPCDex data",
};
export const ARTICLE_NOTE =
  "ROMDex keeps its synced data here. Only thegobindsingh and GenericCola can see this article. Change the data in ROMDex; edits made here are overwritten.";

export interface ManifestFile {
  name: string;
  sha256: string;
  size: number;
  where: string;
  id: string;
  codec: PartCodec;
  type?: string;
}

export interface ManifestSource {
  repo: string;
  commit: string;
  head: string;
  sha256: string;
}

export interface StoreManifest {
  format: "romdex-store";
  version: 1;
  store: StoreName;
  revision: number;
  writtenAt: string;
  writtenBy: string;
  writeId: string;
  files: Record<string, ManifestFile>;
  source?: ManifestSource;
}

export type ManifestRead =
  | { kind: "ok"; manifest: StoreManifest }
  | { kind: "missing" }
  | { kind: "newer"; version: number }
  | { kind: "other-store"; store: string }
  | { kind: "invalid"; reason: string };

export const manifestContent = (manifest: StoreManifest): string => {
  return `${ARTICLE_NOTE}\n\n\`\`\`json\n${JSON.stringify(manifest, null, 2)}\n\`\`\`\n`;
};

export const emptyManifest = (
  store: StoreName,
  writtenBy: string,
  writeId: string,
  writtenAt: string,
): StoreManifest => {
  return {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    store,
    revision: 0,
    writtenAt,
    writtenBy,
    writeId,
    files: {},
  };
};

export { readManifest } from "./manifest-read.ts";
