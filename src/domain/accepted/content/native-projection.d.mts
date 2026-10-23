import type {JsonObject} from "../../json";
export function hasNativeViews(domain:JsonObject):boolean;
export function projectNativeNPCDex(domain:JsonObject,options?:{revision?:number;gender?:string;assetBytes?:(hash:string)=>Uint8Array|undefined}):JsonObject;
