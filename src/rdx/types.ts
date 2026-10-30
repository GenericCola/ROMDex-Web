import type { JsonObject } from "@/domain/json";
export interface RdxFile {
  name: string;
  sha256: string;
  bytes: number;
  data: string;
  documentId: string;
  datasetId: string;
  revision: string;
  kind: "map" | "plan";
}
export interface RdxInspection {
  document: JsonObject;
  projection: JsonObject | null;
  projectionError: string;
  sha256: string;
  preview: JsonObject | null;
  bytes: Uint8Array;
}
export type RdxRequest =
  | { action: "inspect"; bytes: Uint8Array; planOnly?: boolean }
  | {
      action: "merge";
      planOnly?: boolean;
      bytes: Uint8Array;
      local: Uint8Array;
      choices: Record<string, string>;
    };
