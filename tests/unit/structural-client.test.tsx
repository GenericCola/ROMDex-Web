import {test} from "node:test";
import assert from "node:assert/strict";
import {DeliveryClient} from "../../src/youtrack/delivery-client";
import {issueBody} from "../../src/youtrack/issue-body";
import type {TaskItem} from "../../src/domain/types";
const task:TaskItem={id:"local-fixture",summary:"Created",description:"Notes",parentId:null,state:"To do",priority:"Normal",complexity:null,type:"Epic",comments:[],commentCount:0,updated:null};
test("creation validates project schema before POST and uses actual State/enum types",async()=>{
  const original=fetch;const calls:{url:string;method:string;body:unknown}[]=[];
  globalThis.fetch=async(input,init)=>{const url=new URL(String(input));calls.push({url:url.pathname,method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):null});if(url.pathname==="/api/admin/projects")return Response.json([{id:"0-1",shortName:"PMON"}]);if(url.pathname.endsWith("/customFields"))return Response.json(["Type","State","Priority","Complexity"].map((name,i)=>({id:"92-"+i,field:{name,fieldType:{id:name==="State"?"state[1]":"enum[1]"}}})));if(url.pathname==="/api/issues"&&init?.method==="POST")return Response.json({idReadable:"PMON-900001"});throw Error("Unexpected request "+url);};
  try{const client=new DeliveryClient("fixture-token");await client.prepareCreate(task);assert.equal(calls.some(call=>call.method!=="GET"),false);assert.deepEqual(await client.create(task),{id:"PMON-900001"});const body=calls.at(-1)?.body as {project:{id:string};customFields:{$type:string;name:string}[]};assert.equal(body.project.id,"0-1");assert.equal(body.customFields.find(field=>field.name==="State")?.$type,"StateIssueCustomField");assert.equal(calls.filter(call=>call.method==="POST").length,1);}finally{globalThis.fetch=original;}
});
test("native State payload rejects direct assigned aliases and refuses incompatible configuration",()=>{
  const fields=[{id:"92-1",name:"State",$type:"StateIssueCustomField"}];const body=issueBody({state:"Done"},fields);assert.deepEqual(body,{customFields:[{id:"92-1",name:"State",$type:"StateIssueCustomField",value:{name:"Done"}}]});assert.throws(()=>issueBody({state:"Done",assignedState:"To do"},fields),/status journal/);assert.throws(()=>issueBody({state:"Done"},[{...fields[0]!, $type:"StateMachineIssueCustomField"}]),/configuration/);
});
test("hierarchy uses the discovered inward link, verifies detach and rejects remote cycles",async()=>{
  const original=fetch;let parent:string|null="PMON-900001";let cycle=false;const writes:string[]=[];
  const raw=(id:string)=>({id:"2-"+id.split("-")[1],idReadable:id,summary:id,description:"",updated:1,project:{shortName:"PMON"},parent:{issues:(id==="PMON-900003"?parent:cycle&&id==="PMON-900002"?"PMON-900003":null)?[{idReadable:id==="PMON-900003"?parent:"PMON-900003"}]:[]},customFields:[],commentsCount:0,comments:[]});
  globalThis.fetch=async(input,init)=>{const url=new URL(String(input));const path=url.pathname;const method=init?.method??"GET";if(method==="DELETE"){writes.push(method+" "+path);parent=null;return new Response(null,{status:204});}if(method==="POST"){writes.push(method+" "+path);assert.deepEqual(JSON.parse(String(init?.body)),{id:"2-900002"});parent="PMON-900002";return Response.json({});}if(path.endsWith("/links"))return Response.json([{id:"80-77t",direction:"INWARD",linkType:{name:"Subtask"}}]);if(path.includes("/links/"))return Response.json(parent?[{id:"2-900001",idReadable:parent}]:[]);return Response.json(raw(path.split("/").at(-1)!));};
  try{const client=new DeliveryClient("fixture-token");const current=await client.get("PMON-900003");assert.ok(current);await client.update(current.id,{parentId:"PMON-900002"},current);assert.deepEqual(writes,["DELETE /api/issues/PMON-900003/links/80-77t/issues/2-900001","POST /api/issues/PMON-900003/links/80-77t/issues"]);parent="PMON-900001";cycle=true;await assert.rejects(client.update(current.id,{parentId:"PMON-900002"},current),/cycle/);assert.equal(writes.length,2);}finally{globalThis.fetch=original;}
});

test("native State writes require a verifiable current field value",async()=>{
  const original=fetch;let posts=0;globalThis.fetch=async(_input,init)=>{if(init?.method==="POST")posts++;return Response.json({id:"2-900001",idReadable:"PMON-900001",summary:"State fixture",description:"",updated:1,project:{shortName:"PMON"},parent:{issues:[]},customFields:[{id:"92-1",name:"State",$type:"StateIssueCustomField",value:null}],commentsCount:0,comments:[]});};
  try{const client=new DeliveryClient("fixture-token");await client.get("PMON-900001");await assert.rejects(client.update("PMON-900001",{state:"Done",assignedState:"Done"}),/cannot be verified/);assert.equal(posts,0);}finally{globalThis.fetch=original;}
});

test("delivery status reads paginate complete PMON data and reject unreadable State values",async()=>{
  const original=fetch;const skips:number[]=[];let invalid=false;
  globalThis.fetch=async(input,init)=>{assert.equal(init?.method,"GET");const url=new URL(String(input));assert.equal(url.searchParams.get("query"),"project: PMON sort by: created asc");assert.equal(url.searchParams.get("$top"),"500");const skip=Number(url.searchParams.get("$skip"));skips.push(skip);const count=skip===0?500:1;return Response.json(Array.from({length:count},(_,i)=>({id:"2-"+(900000+skip+i),idReadable:"PMON-"+(900000+skip+i),summary:"Synthetic "+i,description:"",updated:1,project:{shortName:"PMON"},parent:{issues:[]},customFields:[{name:"State",value:invalid?null:{name:"Done"}}],commentsCount:0})));};
  try{const client=new DeliveryClient("fixture-token");assert.equal((await client.all()).length,501);assert.deepEqual(skips,[0,500]);invalid=true;await assert.rejects(client.all(),/unreadable/);}finally{globalThis.fetch=original;}
});
