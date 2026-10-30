import type {JsonObject} from '../json';
export function mountPlanImports(options:{button:HTMLButtonElement;api:(route:string,input?:JsonObject)=>Promise<unknown>;flush?:()=>Promise<void>;onReview?:()=>void;notice?:HTMLElement}):{dialog:HTMLDialogElement;isOpen:()=>boolean;isDirty:()=>boolean;dispose:()=>void};
