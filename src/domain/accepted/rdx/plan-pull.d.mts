import type { PlanBinding, PlanLedger } from "../../../rdx/plan-ledger";
import type { JsonObject } from "../../json";
import type { TaskItem, WorkspaceData } from "../../types";
import type { RdxResult } from "./container.mjs";
export interface NativePlanFile {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}
export interface PlanPullEvidence {
  choices?: Record<string, string>;
  comments?: Record<string, TaskItem["comments"]>;
  files?: Record<string, NativePlanFile[]>;
}
export interface PlanPullResult {
  document: JsonObject;
  blobs: Map<string, Uint8Array>;
  bindings: Record<string, PlanBinding>;
  nativePins: { id: string; updated: number | null; fingerprint: string }[];
  conflicts: JsonObject[];
  token: string;
}
export function pullPlan(
  value: RdxResult,
  ledger: PlanLedger,
  state: WorkspaceData,
  options: JsonObject,
  evidence?: PlanPullEvidence,
): PlanPullResult;
