import {test} from "node:test";
import assert from "node:assert/strict";
import {WorkspaceStore} from "../../src/domain/workspace-store";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import type {TaskItem,WorkspaceData} from "../../src/domain/types";
import type {DeliveryPort} from "../../src/cloud/types";
import {deliverQueue} from "../../src/cloud/delivery";
import {editTask,postComment,createTask} from "../../src/domain/task-actions";
const task=():TaskItem=>({id:"PMON-900001",summary:"Original",description:"Old",parentId:null,state:"To do",priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
const setup=async(options:{failAttempt?:boolean;timeout?:boolean;comment?:boolean;failReadback?:boolean}={})=>{
  let saved:WorkspaceData=emptyWorkspace();saved.remote=[task()];
  if(options.comment){saved.commentDrafts[task().id]="comment";postComment(saved,task().id);}else editTask(saved,task().id,{description:"Local"});
  let writes=0,reads=0;let remote=task();
  const persistence={load:async()=>({revision:0,data:structuredClone(saved)}),save:async(data:WorkspaceData,revision:number)=>{if(options.failAttempt&&Object.values(data.cloud?.records??{}).some(record=>record.status==="attempting"))throw Error("disk full");saved=structuredClone(data);return revision+1;}};
  const store=new WorkspaceStore(persistence);await store.start();
  const port:DeliveryPort={accountId:"fixture-owner",get:async()=>{reads++;if(options.failReadback&&reads>1)throw Error("offline");return structuredClone(remote);},update:async(_id,patch)=>{assert.equal(Object.values(saved.cloud?.records??{})[0]?.status,"attempting");writes++;Object.assign(remote,patch);if(options.timeout)throw Error("timeout after acceptance");},comment:async()=>{writes++;return {id:"4-123"};}};
  const run=()=>store.deliver(async commit=>deliverQueue(()=>store.getSnapshot().data,commit,port));
  return {store,port,run,persistence,saved:()=>saved,writes:()=>writes,remote:(patch:Partial<TaskItem>)=>{Object.assign(remote,patch);}};
};
test("durable attempt precedes POST and completion follows readback",async()=>{const s=await setup();s.remote({priority:"High"});await s.run();assert.equal(s.writes(),1);assert.equal(s.saved().operations.length,0);assert.equal(s.saved().remote[0]?.priority,"High");assert.equal(s.saved().cloud?.autoSync,false);});
test("remote conflicts retain both versions and send nothing",async()=>{const s=await setup();s.remote({description:"Remote"});await assert.rejects(s.run(),/conflicting/);assert.equal(s.writes(),0);assert.equal(s.saved().operations.length,1);assert.equal(Object.values(s.saved().cloud?.records??{})[0]?.status,"conflict");assert.throws(()=>s.store.change(data=>editTask(data,task().id,{description:"overwrite"})),/Review/);});
test("timeout after remote acceptance is never automatically replayed, including after restart",async()=>{const s=await setup({timeout:true});await assert.rejects(s.run(),/uncertain/);assert.equal(s.writes(),1);const restored=new WorkspaceStore(s.persistence);await restored.start();await assert.rejects(restored.deliver(async commit=>deliverQueue(()=>restored.getSnapshot().data,commit,s.port)),/uncertain/);assert.equal(s.writes(),1);});
test("failed durable journal write prevents the network mutation",async()=>{const s=await setup({failAttempt:true});await assert.rejects(s.run(),/disk full/);assert.equal(s.writes(),0);assert.equal(s.saved().operations.length,1);});
test("comment receipts remain available when readback fails",async()=>{const s=await setup({comment:true,failReadback:true});await assert.rejects(s.run(),/uncertain/);assert.equal(Object.values(s.saved().cloud?.records??{})[0]?.remoteId,"4-123");assert.equal(s.saved().operations.length,1);await assert.rejects(s.run(),/uncertain/);assert.equal(s.writes(),1);});
test("a changed account cannot deliver a bound queue",async()=>{const s=await setup();await s.store.change(data=>{data.cloud={autoSync:false,records:{},accountId:"different-owner"};});await assert.rejects(s.run(),/different/);assert.equal(s.writes(),0);});
test("an already-applied edit is acknowledged without sending a duplicate",async()=>{const s=await setup();s.remote({description:"Local"});await s.run();assert.equal(s.writes(),0);assert.equal(s.saved().operations.length,0);});
test("unsupported creation remains queued with no network write",async()=>{const s=await setup();await s.store.change(data=>{data.operations=[];createTask(data,null,"New");});await assert.rejects(s.run(),/next delivery adapter/);assert.equal(s.writes(),0);assert.equal(s.saved().operations.length,1);});
test("delivery locks edits and PWA activation while remote IO is in flight",async()=>{const s=await setup();s.port.update=async()=>{assert.throws(()=>s.store.change(()=>undefined),/cloud delivery/);await assert.rejects(s.store.prepareUpdate(),/cloud delivery/);throw Error("stopped");};await assert.rejects(s.run(),/uncertain/);assert.equal(s.store.getSnapshot().delivering,false);});

test("malformed or duplicate queue operations and corrupt journals block delivery",async()=>{
  const {validateWorkspace}=await import("../../src/domain/workspace-data");
  const s=await setup();const baseline=s.saved();
  for(const corrupt of [
    (data:WorkspaceData)=>{data.operations.push(structuredClone(data.operations[0]!));},
    (data:WorkspaceData)=>{Object.assign(data.operations[0]!,{type:"unknown"});},
    (data:WorkspaceData)=>{Object.assign(data.operations[0]!,{patch:{summary:null}});},
    (data:WorkspaceData)=>{data.cloud={accountId:"fixture-owner",autoSync:false,records:{missing:{status:"uncertain",message:"Pending"}}};},
    (data:WorkspaceData)=>{data.cloud={autoSync:false,records:{[data.operations[0]!.opId]:{status:"attempting",message:"Pending"}}};},
  ]){const data=structuredClone(baseline);corrupt(data);assert.throws(()=>validateWorkspace(data),/invalid/);}
  assert.equal(s.writes(),0);
});
test("uncertain delivery also blocks deleting its task",async()=>{
  const {deleteTask}=await import("../../src/domain/task-actions");
  const s=await setup({timeout:true});await assert.rejects(s.run(),/uncertain/);
  assert.throws(()=>s.store.change(data=>deleteTask(data,task().id)),/Review/);assert.equal(s.saved().operations.length,1);
});
test("a crash with a persisted attempting marker never triggers a resend",async()=>{
  const s=await setup();await s.store.change(data=>{data.cloud={accountId:"fixture-owner",autoSync:false,records:{[data.operations[0]!.opId]:{status:"attempting",message:"Crash during send"}}};});
  await assert.rejects(s.run(),/uncertain/);assert.equal(s.writes(),0);
});
