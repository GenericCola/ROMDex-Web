import type { WorkspaceData } from "@/domain/types";
import type { PartValue } from "../parts/files.ts";
import type { StoreName } from "../parts/manifest.ts";

export interface StoreBinding {
  store: StoreName;
  /** Null when this workspace can take part, else a short reason shown to the user. */
  ready: (data: WorkspaceData) => string | null;
  /** Merge keys held by YouTrack, from decoded parts. */
  remote: (parts: PartValue[]) => Record<string, unknown>;
  /** Merge keys held by this browser. Keys it cannot see are carried from base or remote, never removed. */
  local: (
    data: WorkspaceData,
    base: Record<string, unknown> | null,
    remote: Record<string, unknown>,
  ) => Record<string, unknown>;
  /** Parts for the merged values; `remoteParts` gives layout hints (NPCDex root part). */
  parts: (
    merged: Record<string, unknown>,
    remoteParts: PartValue[],
    data: WorkspaceData,
  ) => Promise<PartValue[]>;
  /** Runs before `apply`, outside the workspace change; saves anything `apply` needs to find ready. */
  prepare?: (values: Record<string, unknown>, keys: string[]) => Promise<void>;
  /** Writes `values[key]` (absent = removed) for each key into data. Answers the keys it could not apply now. */
  apply: (
    data: WorkspaceData,
    values: Record<string, unknown>,
    keys: string[],
    remoteParts: PartValue[],
  ) => string[];
}
