import type {JsonObject} from "../../json";
export interface RdxOptions {compress?: boolean;signal?: AbortSignal;limits?: Record<string,number>}
export interface RdxResult {document:JsonObject;canonicalBytes:Uint8Array;documentBytes:Uint8Array;blobs:Map<string,Uint8Array>;manifest:JsonObject;containerSha256:string;requiresHumanTesting:boolean;authorization:string}
export function packRdx(documentBytes:Uint8Array,blobs?:Map<string,Uint8Array>,options?:RdxOptions):Promise<Uint8Array>;
export function unpackRdx(bytes:Uint8Array,options?:RdxOptions):Promise<RdxResult>;
