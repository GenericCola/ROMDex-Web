import type { JsonObject } from '../../json';
import type { WorkspaceData } from '../../types';
import type { RdxResult } from './container.mjs';
export interface PublicationRequest {
 state: WorkspaceData;
 connection: JsonObject | null;
 options?: JsonObject;
 destination?: string | null;
 mappings?: JsonObject;
 choices?: Record<string,string>;
 deletions?: string[];
 matches?: Record<string,string>;
}
export function previewPlanPublication(value:RdxResult, request:PublicationRequest): {preview:JsonObject;batch:JsonObject};

export function fieldTargets(options?: JsonObject | null): JsonObject[];
