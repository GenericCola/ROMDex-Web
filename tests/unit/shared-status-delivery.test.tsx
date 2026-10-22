import {test} from "node:test";
import assert from "node:assert/strict";
import {sharedBackend} from "./shared-status-fixture";
import {DeliveryClient} from "../../src/youtrack/delivery-client";
import {deliverQueue} from "../../src/cloud/delivery";
import {reviewQueue} from "../../src/cloud/review";
import {emptyWorkspace,validateWorkspace} from "../../src/domain/workspace-data";
import {WorkspaceStore} from "../../src/domain/workspace-store";
import type {TaskItem,WorkspaceData} from "../../src/domain/types";
import {editTask,deleteTask} from "../../src/domain/task-actions";
import {enableSharedChoices,localChoices} from "../../src/cloud/shared-status-migration";
import {parseSharedStatus} from "../../src/cloud/shared-status-protocol";
const root="PMON-900001",child="PMON-900002";
const item=(id=root,state="To do",parentId:string|null=null):TaskItem=>({id,summary:id,description:"",parentId,state,assignedState:state,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
const withBackend=async(initial:TaskItem[],fn:(s:ReturnType<typeof sharedBackend>)=>Promise<void>)=>{const original=fetch,s=sharedBackend(initial);globalThis.fetch=s.fetcher;try{await fn(s);}finally{globalThis.fetch=original;}};
const device=async(backend:ReturnType<typeof sharedBackend>,shared=true)=>{
  const port=new DeliveryClient("fixture-token",shared);await port.connect();let saved=emptyWorkspace(),revision=0;saved.remote=await port.all();saved.cloud={accountId:"fixture-owner",autoSync:false,records:{},sharedStatuses:shared};
  const options={disk:false};const persistence={load:async()=>({data:structuredClone(saved),revision}),save:async(data:WorkspaceData,expected:number)=>{assert.equal(expected,revision);if(options.disk&&Object.values(data.cloud?.records??{}).some(record=>record.status==="attempting"))throw Error("disk full");validateWorkspace(data);saved=structuredClone(data);return ++revision;}};
  const store=new WorkspaceStore(persistence);await store.start();
  const run=(active=store)=>{backend.hooks.beforeWrite=(_id,body)=>{const request=body as {opId:string};const record=saved.cloud?.records[request.opId];assert.equal(record?.status,"attempting");assert.deepEqual(record?.metadataWrite,body);};return active.deliver(async commit=>deliverQueue(()=>active.getSnapshot().data,commit,port));};
  const review=(choice:"local"|"cloud"|"confirm",active=store)=>active.deliver(async commit=>reviewQueue(active.getSnapshot().data,commit,port,active.getSnapshot().data.operations[0]!.opId,choice));
  return {port,store,run,review,options,persistence,saved:()=>saved};
};
test("fresh devices read a parent's shared assignment separately from its native rollup",async()=>withBackend([item(),item(child,"Done",root)],async backend=>{
  const a=await device(backend);await a.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await a.run();assert.equal(backend.tasks.get(root)?.state,"Done");const b=await device(backend);assert.equal(b.saved().remote.find(task=>task.id===root)?.assignedState,"Standby");assert.equal(b.saved().remote.find(task=>task.id===root)?.state,"Done");assert.equal(backend.ordinaryWrites.length,0);
  await b.store.change(data=>deleteTask(data,child));await b.run();assert.equal(backend.tasks.get(root)?.state,"Standby");
}));
test("idle Save pulls another device's assignment without overwriting it",async()=>withBackend([item()],async backend=>{
  const a=await device(backend),b=await device(backend);await a.store.change(data=>editTask(data,root,{assignedState:"In Development"}));await a.run();const count=backend.writes.length;await b.run();assert.equal(b.saved().remote[0]?.assignedState,"In Development");assert.equal(backend.writes.length,count);
}));
test("offline assignment conflicts retain both versions and explicit rebase uses a new operation ID",async()=>withBackend([item()],async backend=>{
  const a=await device(backend),b=await device(backend);await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));const old=a.saved().operations[0]!.opId;await b.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await b.run();const count=backend.writes.length;await assert.rejects(a.run(),/conflicting/);assert.equal(backend.writes.length,count);await a.review("local");assert.notEqual(a.saved().operations[0]?.opId,old);assert.equal(a.saved().cloud?.records[old]?.status,"confirmed");await a.run();assert.equal(a.saved().remote[0]?.assignedState,"Done");
}));
test("an intervening revision conflicts even when the shared choice returns to its original value",async()=>withBackend([item()],async backend=>{
  const a=await device(backend),b=await device(backend);await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));for(const value of ["Standby","To do"]){await b.store.change(data=>editTask(data,root,{assignedState:value}));await b.run();}await assert.rejects(a.run(),/conflicting/);assert.ok(Object.values(a.saved().cloud!.records).some(record=>record.conflicts?.some(conflict=>conflict.field==="assignedState revision")));
}));
test("lost metadata response survives reload and exact receipt confirmation never resends",async()=>withBackend([item()],async backend=>{
  const a=await device(backend);backend.options.lostAssign=true;await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(a.run(),/uncertain/);assert.equal(backend.writes.length,1);const restored=new WorkspaceStore(a.persistence);await restored.start();await assert.rejects(a.run(restored),/uncertain/);assert.equal(backend.writes.length,1);await a.review("confirm",restored);await a.run(restored);assert.equal(backend.writes.filter(write=>(write.body as {kind:string}).kind==="assign").length,1);assert.equal(backend.tasks.get(root)?.state,"Done");
}));
test("an interrupted shared parent rollup preserves its assignment across devices and recovery",async()=>withBackend([item(),item(child,"Done",root)],async backend=>{
  const a=await device(backend);backend.options.lostRollup=true;await a.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await assert.rejects(a.run(),/uncertain/);const b=await device(backend);assert.equal(b.saved().remote[0]?.assignedState,"Standby");await a.review("confirm");const count=backend.writes.length;await a.run();assert.equal(backend.writes.length,count);assert.equal(a.saved().remote[0]?.assignedState,"Standby");
}));
test("receipt mismatch cannot confirm an uncertain assignment by matching value alone",async()=>withBackend([item()],async backend=>{
  const a=await device(backend);backend.options.lostAssign=true;await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(a.run(),/uncertain/);const stored=JSON.parse(backend.tasks.get(root)!.metadata!);stored.receipt.opId="different-operation";backend.tasks.get(root)!.metadata=JSON.stringify(stored);await assert.rejects(a.review("confirm"),/exact shared-status/);assert.equal(a.saved().operations.length,1);
}));
test("failed local journaling, missing app, corrupt metadata and server rollback never use native fallback",async()=>withBackend([item()],async backend=>{
  const a=await device(backend);await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));a.options.disk=true;await assert.rejects(a.run(),/disk full/);assert.equal(backend.writes.length,0);assert.equal(backend.ordinaryWrites.length,0);
  const b=await device(backend);backend.options.appMissing=true;await assert.rejects(b.run(),/Invalid shared-status/);assert.equal(backend.ordinaryWrites.length,0);backend.options.appMissing=false;backend.options.corrupt=true;await assert.rejects(b.run(),/Invalid shared-status/);backend.options.corrupt=false;
  const c=await device(backend);await c.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await c.run();delete backend.tasks.get(root)!.metadata;await assert.rejects(c.run(),/backwards/);
}));
test("migration is explicit, archives browser choices, and refuses stale previews or pending edits",async()=>withBackend([item()],async backend=>{
  const a=await device(backend,false);await a.store.change(data=>{data.remote[0]!.assignedState="Standby";});const preview={accountId:a.port.accountId,local:localChoices(a.saved()),items:await a.port.readShared()};assert.equal(backend.writes.length,0);const pending=structuredClone(a.saved());editTask(pending,root,{description:"queued"});assert.throws(()=>enableSharedChoices(pending,preview,"cloud"),/pending changes/);
  const stale=structuredClone(a.saved());stale.remote[0]!.assignedState="Done";assert.throws(()=>enableSharedChoices(stale,preview,"cloud"),/changed/);
  await a.store.change(data=>enableSharedChoices(data,preview,"cloud"));assert.equal(a.saved().cloud?.sharedStatuses,true);assert.equal(a.saved().remote[0]?.assignedState,"To do");assert.match(a.store.recover(),/Standby/);assert.equal(a.saved().operations.length,0);assert.equal(backend.writes.length,0);
}));
test("choosing browser differences queues revision-checked metadata rather than writing during migration",async()=>withBackend([item()],async backend=>{
  const a=await device(backend,false);await a.store.change(data=>{data.remote[0]!.assignedState="Standby";});const preview={accountId:a.port.accountId,local:localChoices(a.saved()),items:await a.port.readShared()};await a.store.change(data=>enableSharedChoices(data,preview,"browser"));a.port.enableShared();assert.equal(backend.writes.length,0);assert.equal(a.saved().operations.length,1);await a.run();assert.equal(a.saved().remote[0]?.assignedState,"Standby");assert.equal(backend.tasks.get(root)?.state,"Standby");
}));
test("metadata-only success before a later property failure is recovered without duplicate metadata",async()=>withBackend([item()],async backend=>{
  const a=await device(backend);backend.options.lostAssign=true;await a.store.change(data=>editTask(data,root,{assignedState:"Done",description:"Local notes"}));await assert.rejects(a.run(),/uncertain/);await assert.rejects(a.review("confirm"),/does not match/);await a.review("local");await a.run();assert.equal(backend.writes.filter(write=>(write.body as {kind:string}).kind==="assign").length,1);assert.equal(backend.ordinaryWrites.length,1);assert.equal(backend.tasks.get(root)?.description,"Local notes");
}));
test("corrupt wire snapshots and persisted metadata requests block delivery",async()=>withBackend([item()],async backend=>{
  const a=await device(backend);const base=a.saved().remote[0]!.sharedStatus!;assert.throws(()=>parseSharedStatus({...base,schema:2},root),/Invalid/);assert.throws(()=>parseSharedStatus({...base,assignedState:"Standby"},root),/Invalid/);backend.options.lostAssign=true;await a.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(a.run(),/uncertain/);const bad=structuredClone(a.saved());const record=Object.values(bad.cloud!.records)[0]!;record.metadataWrite!.opId="wrong";assert.throws(()=>validateWorkspace(bad),/invalid/);
}));

test("a metadata revision change without a native timestamp change stops a planned rollup before sending",async()=>withBackend([item(),item(child,"Done",root)],async backend=>{
  const a=await device(backend),get=a.port.get;let changed=false;
  a.port.get=async id=>{const op=a.store.getSnapshot().data.operations[0];if(!changed&&op?.type==="edit"&&op.purpose==="rollup"){changed=true;const current=backend.call(id,"GET").body as Record<string,unknown>;const updated=backend.tasks.get(id)!.updated;backend.call(id,"POST",{schema:1,opId:"other-device",kind:"assign",value:"In Development",expected:{revision:current.revision,initialized:current.initialized,assignedState:current.assignedState,state:current.state,updated:current.updated}});backend.tasks.get(id)!.updated=updated;}return get(id);};
  await a.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await assert.rejects(a.run(),/target changed/);assert.equal(backend.tasks.get(root)?.state,"To do");assert.equal(backend.writes.filter(write=>(write.body as {kind:string}).kind==="rollup").length,0);await a.run();assert.equal(a.saved().remote[0]?.assignedState,"In Development");assert.equal(backend.tasks.get(root)?.state,"Done");
}));
