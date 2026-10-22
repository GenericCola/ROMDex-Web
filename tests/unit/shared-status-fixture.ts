import { createRequire } from "node:module";
import type { TaskItem } from "../../src/domain/types";
const require=createRequire(import.meta.url);
const handler=require("../../youtrack-app/status.js").httpHandler as {endpoints:{scope:string;method:string;path:string;permissions?:string[];handle:(ctx:unknown)=>void}[]};
export interface FixtureTask extends TaskItem {metadata?:string; readable?:boolean; writable?:boolean; hiddenState?:boolean; external?:boolean}
export const sharedBackend=(initial:TaskItem[])=>{
  const tasks=new Map(initial.map(item=>[item.id,structuredClone(item) as FixtureTask]));
  const options={appMissing:false,corrupt:false,lostAssign:false,lostRollup:false,workflowReject:false};
  const hooks={beforeWrite:(_id:string,_body:unknown)=>{}};
  const writes:{id:string;body:unknown;status:number}[]=[];const ordinaryWrites:{id:string;body:unknown}[]=[];
  const states=["To do","In Progress","Standby","In Development","Done","Critical / Debugging","Fixed","Open"];
  const wrap=(id:string,map=tasks):unknown=>{
    const task=map.get(id)!;
    const stateField={typeName:"state[1]",values:states.map(name=>({name})),isVisibleInIssue:()=>!task.hiddenState};
    const issue={id,updated:task.updated,isReported:true,isVisibleTo:()=>task.readable!==false,project:{shortName:task.external?"OTHER":"PMON",canBeReadBy:()=>task.readable!==false,canBeWrittenBy:()=>task.writable!==false,findFieldByName:()=>stateField},fields:{get State(){return {name:task.state};},set State(value:{name:string}){task.state=value.name;if(options.workflowReject)throw Object.assign(Error("workflow rejected"),{status:409});}},extensionProperties:{get assignedStatus(){return task.metadata??null;},set assignedStatus(value:string){task.metadata=value;}},links:{'parent for':{forEach:(fn:(item:unknown)=>void)=>{for(const item of map.values())if(item.parentId===id)fn(wrap(item.id,map));},isEmpty:()=>![...map.values()].some(item=>item.parentId===id)}}};
    return issue;
  };
  const call=(id:string,method:string,body?:unknown)=>{
    if(options.appMissing)return {status:404,body:null};
    const endpoint=handler.endpoints.find(endpoint=>endpoint.method===method&&endpoint.path===(id?"assigned":"capabilities"));if(!endpoint)throw Error("Unknown app route");
    const copy=structuredClone(tasks);let result:unknown;
    const response={code:200,addHeader:(name:string,value:string)=>{if(name==="Cache-Control"&&value!=="no-store")throw Error("cache leaked");},json:(value:unknown)=>{result=value;}};
    endpoint.handle({issue:id?wrap(id,copy):undefined,currentUser:{login:"fixture-owner"},request:{body:JSON.stringify(body),json:()=>structuredClone(body)},response});
    if(method==="POST")writes.push({id,body:structuredClone(body),status:response.code});
    {for(const [key,item]of copy){const old=tasks.get(key);if(JSON.stringify(old)!==JSON.stringify(item)){item.updated=(old?.updated??0)+1;tasks.set(key,item);}}}
    return {status:response.code,body:options.corrupt?{schema:999}:result};
  };
  const raw=(item:FixtureTask)=>({id:"2-"+item.id.split("-")[1],idReadable:item.id,summary:item.summary,description:item.description,updated:item.updated,project:{shortName:"PMON"},parent:{issues:item.parentId?[{idReadable:item.parentId}]:[]},customFields:["Type","State","Priority","Complexity"].map((name,i)=>({id:"92-"+i,name,$type:name==="State"?"StateIssueCustomField":"SingleEnumIssueCustomField",value:item[name.toLowerCase() as "state"|"priority"|"complexity"|"type"]===null?null:{name:item[name.toLowerCase() as "state"|"priority"|"complexity"|"type"]}})),commentsCount:item.commentCount,comments:[]});
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));if(url.origin!=="https://thegobindsingh.youtrack.cloud")throw Error("Unexpected network");const method=init?.method??"GET",path=url.pathname;const body=init?.body?JSON.parse(String(init.body)):undefined;
    if(path==="/api/users/me")return Response.json({id:"fixture-owner"});
    if(path==="/api/extensionEndpoints/romdex-status/status/capabilities"){const response=call("",method,body);return Response.json(response.body,{status:response.status});}
    if(path==="/api/issues"){const skip=Number(url.searchParams.get("$skip")??0);return Response.json([...tasks.values()].slice(skip,skip+100).map(raw));}
    const id=path.split("/")[3]??"",task=tasks.get(id);if(!task)return Response.json(null,{status:404});
    if(path.endsWith("/extensionEndpoints/romdex-status/status/assigned")){
      if(method==="POST")hooks.beforeWrite(id,body);
      const result=call(id,method,body);if(method==="POST"&&((body.kind==="assign"&&options.lostAssign)||(body.kind==="rollup"&&options.lostRollup))){options.lostAssign=false;options.lostRollup=false;throw Error("accepted response lost");}return Response.json(result.body,{status:result.status});
    }
    if(path.endsWith("/links"))return Response.json([{id:"80-3s",direction:"OUTWARD",linkType:{name:"Subtask"}}]);
    if(path.includes("/links/"))return Response.json([...tasks.values()].filter(item=>item.parentId===id).map(item=>({idReadable:item.id,id:"2-"+item.id.split("-")[1]})));
    if(method==="DELETE"){tasks.delete(id);return new Response(null,{status:204});}
    if(method==="POST"){ordinaryWrites.push({id,body});for(const key of ["summary","description"] as const)if(key in body)task[key]=body[key];task.updated=(task.updated??0)+1;return Response.json({});}
    return Response.json(raw(task));
  };
  return {tasks,options,hooks,writes,ordinaryWrites,call,raw,fetcher,handler};
};
