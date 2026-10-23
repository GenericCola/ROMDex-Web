import type {JsonObject} from "../../json";
import type {RdxResult} from "./container.mjs";
export interface RdxMerge {document:JsonObject;blobs:Map<string,Uint8Array>;preview:JsonObject}
export function mapDomain(value:RdxResult):JsonObject;
export function previewMapImport(incoming:RdxResult,local?:RdxResult|null,options?:{choices?:Record<string,string>}):RdxMerge;
