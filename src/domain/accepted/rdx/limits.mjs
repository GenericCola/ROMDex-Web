export const LIMITS=Object.freeze({manifest:1024*1024,stored:512*1024*1024,decoded:1024*1024*1024,entries:10000,json:16*1024*1024,blob:50*1024*1024,depth:64,nodes:300000,milliseconds:30000});
export class RdxError extends Error{constructor(code,message){super(message);this.name='RdxError';this.code=code;}}
export const ensure=(ok,code,message)=>{if(!ok)throw new RdxError(code,message);};
export function bounds(overrides={}){
 const limits={...LIMITS};for(const [key,value]of Object.entries(overrides)){
  ensure(Object.hasOwn(limits,key)&&Number.isSafeInteger(value)&&value>0&&value<=LIMITS[key],'LIMIT','Invalid RDX Limit: '+key);limits[key]=value;
 }return limits;
}
export function operation({signal,limits}={}){
 const selected=bounds(limits),controller=new AbortController(),abort=()=>controller.abort(signal.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const end=Date.now()+selected.milliseconds,timer=setTimeout(()=>controller.abort(new RdxError('LIMIT','RDX Work Time Limit Exceeded.')),selected.milliseconds);timer.unref?.();
 return {limits:selected,signal:controller.signal,check(){if(controller.signal.aborted)throw controller.signal.reason||new RdxError('CANCELLED','RDX Operation Cancelled.');ensure(Date.now()<=end,'LIMIT','RDX Work Time Limit Exceeded.');},close(){clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
}
