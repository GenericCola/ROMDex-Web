import type {JsonObject} from "../../json";
import type {RdxResult} from "./container.mjs";
import type {RdxMerge} from "./map-import.mjs";
export function previewPlanImport(incoming:RdxResult,local?:RdxResult|null,choices?:Record<string,string>):RdxMerge;
export function taskRevision(task:JsonObject):string;
export function orderedTasks(document:JsonObject):JsonObject[];
