import {test} from "node:test";
import assert from "node:assert/strict";
import {workspaceStore} from "../../src/domain/workspace-store";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import type {WorkspaceSnapshot} from "../../src/domain/types";
import {registerDraftEditor} from "../../src/domain/editor-drafts";
import {setTaskTextEditing} from "../../src/domain/task-editing";
import {connectDelivery,disconnectDelivery,automaticDelivery,saveDelivery} from "../../src/cloud/session";
test("automatic delivery rechecks note focus after asynchronous editor preparation; explicit Save remains allowed",async t=>{
 const data=emptyWorkspace();data.cloud={...data.cloud,autoSync:true,rollupPending:true};
 const state:WorkspaceSnapshot={ready:true,updating:false,delivering:false,data,pendingWrites:0,error:"",connection:""};let deliveries=0,begin!:()=>void,release!:()=>void;
 const began=new Promise<void>(resolve=>{begin=resolve;}),hold=new Promise<void>(resolve=>{release=resolve;});
 t.mock.method(workspaceStore,"start",async()=>{});t.mock.method(workspaceStore,"getSnapshot",()=>state);
 t.mock.method(workspaceStore,"change",async(update:(value:typeof data)=>void)=>{update(data);});t.mock.method(workspaceStore,"flush",async()=>{});t.mock.method(workspaceStore,"setConnection",()=>{});t.mock.method(workspaceStore,"deliver",async()=>{deliveries++;});
 t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL)=>{assert.match(String(input),/\/api\/users\/me\?fields=id$/);return Response.json({id:"fictional-owner"});});
 const unregister=registerDraftEditor({dirty:()=>true,flush:async()=>{begin();await hold;}});
 try{
  await connectDelivery("fictional-session-token");automaticDelivery();await began;setTaskTextEditing("task:notes",true);release();
  await new Promise<void>(resolve=>{setTimeout(resolve,0);});assert.equal(deliveries,0);
  await saveDelivery();assert.equal(deliveries,1);
 }finally{release();setTaskTextEditing("task:notes",false);unregister();disconnectDelivery();}
});