import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { createTask, deleteTask, editTask, postComment } from "../../src/domain/task-actions";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import type { DeliveryPort } from "../../src/cloud/types";
import { deliverQueue } from "../../src/cloud/delivery";
import { reviewQueue } from "../../src/cloud/review";
const item=(id="PMON-900001",parentId:string|null=null):TaskItem=>({id,dbId:"2-"+id.split("-")[1],summary:"Fixture "+id,description:"",state:"To do",assignedState:"To do",priority:"Normal",complexity:null,type:"Task",parentId,comments:[],commentCount:0,updated:1});
const setup=async(initial:TaskItem[]=[],options:{createTimeout?:boolean;deleteTimeout?:boolean;halfMove?:boolean;parentTouched?:boolean;readbackFails?:boolean;diskFails?:boolean}={})=>{
  let saved=emptyWorkspace();saved.remote=structuredClone(initial);let revision=0;let creates=0,moves=0,comments=0;const deletes:string[]=[];const remote=new Map(initial.map(task=>[task.id,structuredClone(task)]));
  const persistence={load:async()=>({data:structuredClone(saved),revision}),save:async(data:WorkspaceData,expected:number)=>{assert.equal(expected,revision);if(options.diskFails&&Object.values(data.cloud?.records??{}).some(record=>record.status==="attempting"))throw Error("disk full");saved=structuredClone(data);return ++revision;}};
  const store=new WorkspaceStore(persistence);await store.start();
  const port:DeliveryPort & {verifyComment:(id:string,receipt:string,text:string)=>Promise<void>}={all:async()=>structuredClone([...remote.values()]),accountId:"fixture-owner",verifyComment:async()=>{},prepareCreate:async(task)=>{if(task.parentId)assert.equal(remote.has(task.parentId),true);},create:async(task)=>{assert.equal(saved.cloud?.records[saved.operations[0]!.opId]?.status,"attempting");creates++;const id="PMON-"+(900100+creates);remote.set(id,{...structuredClone(task),id,dbId:"2-"+(900100+creates),parentId:null,updated:1});if(options.createTimeout)throw Error("lost creation receipt");return {id};},get:async(id)=>{if(options.readbackFails&&creates)throw Error("readback offline");return structuredClone(remote.get(id)??null);},children:async(id)=>[...remote.values()].filter(task=>task.parentId===id).map(task=>task.id),update:async(id,patch)=>{moves++;const task=remote.get(id);assert.ok(task);if(options.halfMove&&patch.parentId){task.parentId=null;options.halfMove=false;throw Error("attachment interrupted");}Object.assign(task,patch);},remove:async(id)=>{assert.equal(saved.cloud?.records[saved.operations[0]!.opId]?.targetId,id);deletes.push(id);const task=remote.get(id);remote.delete(id);if(options.parentTouched&&task?.parentId){const parent=remote.get(task.parentId);if(parent)parent.updated=2;}if(options.deleteTimeout){options.deleteTimeout=false;throw Error("lost DELETE response");}},comment:async()=>{comments++;return {id:"4-123"};}};
  const run=()=>store.deliver(async commit=>deliverQueue(()=>store.getSnapshot().data,commit,port));
  const review=(choice:"cloud"|"local"|"confirm",receipt="",ack=false)=>store.deliver(async commit=>reviewQueue(store.getSnapshot().data,commit,port,store.getSnapshot().data.operations[0]!.opId,choice,receipt,ack));
  return {store,port,run,review,remote,options,deletes,saved:()=>saved,counts:()=>({creates,moves,comments}),persistence};
};
test("creation remaps descendants, later edit baselines, drafts, order and selection durably",async()=>{
  const s=await setup();let root="",child="";await s.store.change(data=>{root=createTask(data,null,"Root");child=createTask(data,root,"Child");data.commentDrafts[child]="posted";postComment(data,child);editTask(data,child,{description:"later edit"});data.commentDrafts[root]="unposted";data.titleDrafts[root]="title draft";data.order[root]=7;data.view.selected=root;data.view.scope=root;data.view.expanded=[root];data.view.selectorExpanded=[root];data.newTask={title:"Another",parentId:root};});
  await s.run();const data=s.saved();assert.equal(data.operations.length,0);assert.equal(s.counts().creates,2);assert.equal(s.counts().comments,1);assert.equal(data.remote.find(task=>task.id==="PMON-900102")?.parentId,"PMON-900101");assert.equal(data.remote.find(task=>task.id==="PMON-900102")?.description,"later edit");assert.equal(data.commentDrafts["PMON-900101"],"unposted");assert.equal(data.titleDrafts["PMON-900101"],"title draft");assert.equal(data.order["PMON-900101"],7);assert.equal(data.view.selected,"PMON-900101");assert.equal(data.newTask?.parentId,"PMON-900101");assert.equal(JSON.stringify(data.operations).includes(root),false);
});
test("lost creation receipt survives restart without duplicate creation; exact ID recovery maps dependents",async()=>{
  const s=await setup([],{createTimeout:true});await s.store.change(data=>{const id=createTask(data,null,"Root");createTask(data,id,"Child");});await assert.rejects(s.run(),/uncertain/);const restored=new WorkspaceStore(s.persistence);await restored.start();await assert.rejects(restored.deliver(async commit=>deliverQueue(()=>restored.getSnapshot().data,commit,s.port)),/uncertain/);assert.equal(s.counts().creates,1);const recover=(receipt:string)=>restored.deliver(async commit=>reviewQueue(restored.getSnapshot().data,commit,s.port,restored.getSnapshot().data.operations[0]!.opId,"confirm",receipt));await assert.rejects(recover("PMON-999999"),/not readable/);await recover("PMON-900101");s.options.createTimeout=false;await restored.deliver(async commit=>deliverQueue(()=>restored.getSnapshot().data,commit,s.port));assert.equal(s.counts().creates,2);assert.equal(s.saved().operations.length,0);
});
test("creation receipt is durable when verification fails and abandonment archives dependents",async()=>{
  const s=await setup([],{readbackFails:true});await s.store.change(data=>{const id=createTask(data,null,"Root");createTask(data,id,"Child");});await assert.rejects(s.run(),/uncertain/);assert.equal(Object.values(s.saved().cloud?.records??{})[0]?.remoteId,"PMON-900101");await s.review("cloud");assert.equal(s.saved().operations.length,0);assert.equal(s.counts().creates,1);assert.equal(Object.values(s.saved().cloud?.records??{}).filter(record=>record.archivedOperation?.type==="create").length,2);
});
test("deleting an unsent local subtree archives content and sends no creation or deletion",async()=>{
  const s=await setup();await s.store.change(data=>{const root=createTask(data,null,"Root");const child=createTask(data,root,"Child");editTask(data,child,{description:"preserved notes"});deleteTask(data,root);});await s.run();assert.equal(s.counts().creates,0);assert.deepEqual(s.deletes,[]);assert.match(s.store.recover(),/preserved notes/);
});
test("deletion rejects changed tasks and unreviewed descendants before any DELETE",async()=>{
  const s=await setup([item()]);await s.store.change(data=>deleteTask(data,item().id));s.remote.get(item().id)!.description="External notes";await assert.rejects(s.run(),/changed deletion/);assert.deepEqual(s.deletes,[]);await s.review("local");s.remote.set("PMON-900002",item("PMON-900002",item().id));await assert.rejects(s.run(),/unreviewed child/);assert.deepEqual(s.deletes,[]);
});
test("deletion is leaf first, journals each result and rechecks a parent touched by child removal",async()=>{
  const root=item(),child=item("PMON-900002",root.id);const s=await setup([root,child],{parentTouched:true});await s.store.change(data=>deleteTask(data,root.id));await assert.rejects(s.run(),/changed deletion/);assert.deepEqual(s.deletes,[child.id]);assert.deepEqual(Object.values(s.saved().cloud?.records??{})[0]?.deletedIds,[child.id]);await s.review("local");await s.run();assert.deepEqual(s.deletes,[child.id,root.id]);assert.equal(s.saved().operations.length,0);
});
test("lost DELETE response never retries; acknowledging missing is explicit and preserves remaining work",async()=>{
  const root=item(),child=item("PMON-900002",root.id);const s=await setup([root,child],{deleteTimeout:true});await s.store.change(data=>deleteTask(data,root.id));await assert.rejects(s.run(),/uncertain/);await assert.rejects(s.run(),/uncertain/);assert.deepEqual(s.deletes,[child.id]);await assert.rejects(s.review("confirm"),/Explicitly acknowledge/);await s.review("confirm","",true);await s.run();assert.deepEqual(s.deletes,[child.id,root.id]);assert.equal(s.saved().operations.length,0);
});
test("disk failure blocks DELETE before the network request",async()=>{
  const s=await setup([item()],{diskFails:true});await s.store.change(data=>deleteTask(data,item().id));await assert.rejects(s.run(),/disk full/);assert.deepEqual(s.deletes,[]);
});
test("partially detached hierarchy needs explicit readback rebase; native State conflicts send nothing",async()=>{
  const root=item(),parent=item("PMON-900002"),child=item("PMON-900003",root.id);const s=await setup([root,parent,child],{halfMove:true});await s.store.change(data=>editTask(data,child.id,{parentId:parent.id}));await assert.rejects(s.run(),/uncertain/);await assert.rejects(s.run(),/uncertain/);await assert.rejects(s.review("confirm"),/does not match/);await s.review("local");await s.run();assert.equal(s.remote.get(child.id)?.parentId,parent.id);await s.store.change(data=>editTask(data,child.id,{state:"Done",assignedState:"Done"}));Object.assign(s.remote.get(child.id)!,{state:"In Progress",assignedState:"In Progress"});await assert.rejects(s.run(),/conflicting/);assert.equal(s.counts().moves,2);
});

test("legacy local create/delete queues cancel without sending and keep their original recovery records",async()=>{
  const s=await setup();await s.store.change(data=>{const id=createTask(data,null,"Legacy local");data.operations.push({opId:"legacy-delete",type:"delete",issueId:id,ids:[id]});});await s.run();assert.equal(s.counts().creates,0);assert.deepEqual(s.deletes,[]);assert.equal(s.saved().operations.length,0);const archived=s.saved().cloud?.records["legacy-delete"]?.archivedOperation;assert.equal(archived?.type,"delete");if(archived?.type==="delete")assert.equal(archived.ids.length,1);
});

test("deletion approval cannot accept a newer unseen snapshot",async()=>{
  const s=await setup([item()]);await s.store.change(data=>deleteTask(data,item().id));s.remote.get(item().id)!.description="First external edit";await assert.rejects(s.run(),/changed deletion/);s.remote.get(item().id)!.description="Second external edit";await assert.rejects(s.review("local"),/changed again/);assert.deepEqual(s.deletes,[]);await s.review("local");await s.run();assert.deepEqual(s.deletes,[item().id]);
});

test("corrupt deletion receipts cannot skip unapproved targets",async()=>{
  const {validateWorkspace}=await import("../../src/domain/workspace-data");const s=await setup([item()]);await s.store.change(data=>deleteTask(data,item().id));const data=structuredClone(s.saved());const op=data.operations[0]!;data.cloud={accountId:"fixture-owner",autoSync:false,records:{[op.opId]:{status:"ready",message:"Corrupt receipt",deletedIds:["PMON-999999"]}}};assert.throws(()=>validateWorkspace(data),/invalid/);
});

test("a later queued local parent is created before its dependent without losing intent",async()=>{
  const s=await setup();await s.store.change(data=>{const child=createTask(data,null,"Earlier child");const parent=createTask(data,null,"Later parent");editTask(data,child,{parentId:parent});});await s.run();assert.equal(s.counts().creates,2);assert.equal(s.remote.get("PMON-900101")?.summary,"Later parent");assert.equal(s.remote.get("PMON-900102")?.parentId,"PMON-900101");assert.equal(s.saved().operations.length,0);
});

test("stale deletion review allows browsing and safe cancellation without any remote deletion",async()=>{
  const s=await setup([item()]);await s.store.change(data=>deleteTask(data,item().id));
  Object.assign(s.remote.get(item().id)!,{state:"Done",commentCount:1,comments:[{id:"fixture-comment",text:"Investigation",author:"Fixture",created:2}]});
  await assert.rejects(s.run(),/changed deletion/);
  await s.store.change(data=>{data.view.scope=item().id;data.view.selected=item().id;});
  assert.equal(s.store.getSnapshot().data.view.selected,item().id);
  await s.review("cloud");
  assert.deepEqual(s.deletes,[]);assert.equal(s.saved().operations.length,0);
  assert.equal(s.saved().remote[0]?.state,"Done");
  await s.store.change(data=>editTask(data,item().id,{summary:"Local edit after cancellation"}));
  assert.equal(s.saved().operations.length,1);assert.deepEqual(s.deletes,[]);
});
