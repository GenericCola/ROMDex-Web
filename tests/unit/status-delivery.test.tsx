import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../../src/domain/workspace-store";
import { emptyWorkspace, validateWorkspace } from "../../src/domain/workspace-data";
import { createTask, deleteTask, editTask } from "../../src/domain/task-actions";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import type { DeliveryPort } from "../../src/cloud/types";
import { deliverQueue } from "../../src/cloud/delivery";
import { reviewQueue } from "../../src/cloud/review";
import { adoptTasks, observeStatus, seedAssigned } from "../../src/cloud/assigned-status";
const task=(id:string,state="To do",parentId:string|null=null,assignedState=state):TaskItem=>({id,summary:id,description:"",parentId,state,assignedState,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
const root="PMON-900001",child="PMON-900002",other="PMON-900003";
const setup=async(initial:TaskItem[])=>{
  let saved=emptyWorkspace();saved.remote=structuredClone(initial);let revision=0;
  const remote=new Map(initial.map(item=>[item.id,structuredClone(item)]));
  const writes:{id:string;patch:unknown}[]=[];const options={lost:false,disk:false,allOffline:false,omit:"",extraChild:"",movedDuringRead:false};
  const persistence={load:async()=>({data:structuredClone(saved),revision}),save:async(data:WorkspaceData,expected:number)=>{assert.equal(expected,revision);if(options.disk&&Object.values(data.cloud?.records??{}).some(record=>record.status==="attempting"))throw Error("disk full");validateWorkspace(data);saved=structuredClone(data);return ++revision;}};
  const store=new WorkspaceStore(persistence);await store.start();
  const raw=(item:TaskItem|null)=>{if(!item)return null;const copy=structuredClone(item);delete copy.assignedState;return copy;};
  const port:DeliveryPort & {verifyComment:()=>Promise<void>}={accountId:"fixture-owner",verifyComment:async()=>{},
    all:async()=>{if(options.allOffline)throw Error("project read offline");return [...remote.values()].filter(item=>item.id!==options.omit).map(item=>raw(item)!);},
    get:async(id)=>raw(remote.get(id)??null),children:async(id)=>{const ids=[...remote.values()].filter(item=>item.parentId===id).map(item=>item.id);if(id===root&&options.extraChild)ids.push(options.extraChild);return ids;},
    update:async(id,patch)=>{const record=Object.values(saved.cloud?.records??{}).find(record=>record.status==="attempting");assert.equal(record?.targetId,id);assert.equal(patch.assignedState,undefined);if(patch.state)assert.equal(saved.cloud?.assigned?.[id]?.pendingState,patch.state);writes.push({id,patch});const item=remote.get(id)!;Object.assign(item,patch);item.updated=(item.updated??0)+1;if(options.lost){options.lost=false;throw Error("accepted but reply lost");}},
    prepareCreate:async()=>{},create:async(item)=>{const id="PMON-900100";remote.set(id,{...item,id,parentId:null,state:item.assignedState??item.state,updated:1});return {id};},remove:async(id)=>{remote.delete(id);},comment:async()=>({id:"4-1"})};
  const run=(active=store)=>active.deliver(async commit=>deliverQueue(()=>active.getSnapshot().data,commit,port));
  const review=(choice:"cloud"|"local"|"confirm",active=store)=>active.deliver(async commit=>reviewQueue(active.getSnapshot().data,commit,port,active.getSnapshot().data.operations[0]!.opId,choice));
  return {store,run,review,port,remote,writes,options,persistence,saved:()=>saved};
};
test("parent assignment survives rollup, reload and explicit remote refresh",async()=>{
  const s=await setup([task(root),task(child,"To do",root)]);
  await s.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await s.run();assert.equal(s.writes.length,0);assert.equal(s.saved().remote[0]?.assignedState,"Standby");assert.equal(s.remote.get(root)?.state,"To do");
  await s.store.change(data=>editTask(data,child,{assignedState:"Done"}));await s.run();assert.deepEqual(s.writes.map(write=>write.id),[child,root]);assert.equal(s.remote.get(root)?.state,"Done");assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Standby");assert.equal(s.saved().cloud?.rollupPending,false);
  const restored=new WorkspaceStore(s.persistence);await restored.start();await restored.change(data=>adoptTasks(data,[...s.remote.values()].map(item=>({...item,assignedState:item.state}))));assert.equal(s.saved().remote.find(item=>item.id===root)?.assignedState,"Standby");assert.match(restored.recover(),/assignedState/);
});
test("moving and deleting the last child restore each parent's own status",async()=>{
  const s=await setup([task(root,"Done",null,"Standby"),task(child,"Done",root),task(other)]);
  await s.store.change(data=>editTask(data,child,{parentId:other}));await s.run();assert.equal(s.remote.get(root)?.state,"Standby");assert.equal(s.remote.get(other)?.state,"Done");assert.equal(s.saved().remote.find(item=>item.id===other)?.assignedState,"To do");
  await s.store.change(data=>deleteTask(data,child));await s.run();assert.equal(s.remote.get(other)?.state,"To do");assert.equal(s.saved().operations.length,0);
});
test("new child creation and deletion recalculate parents without replacing assignments",async()=>{
  const s=await setup([task(root,"Done",null,"Standby"),task(child,"Done",root)]);
  await s.store.change(data=>{const id=createTask(data,root,"New child");editTask(data,id,{assignedState:"In Development"});});await s.run();assert.equal(s.remote.get("PMON-900100")?.state,"In Development");assert.equal(s.remote.get(root)?.state,"In Development");assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Standby");
  await s.store.change(data=>deleteTask(data,"PMON-900100"));await s.run();assert.equal(s.remote.get(root)?.state,"Done");
});
test("nested rollups use accepted color precedence and write deepest parents first",async()=>{
  const leaf="PMON-900004",sibling="PMON-900005";
  const s=await setup([task(root),task(child,"To do",root),task(leaf,"To do",child),task(sibling,"In Development",root)]);
  await s.store.change(data=>editTask(data,leaf,{assignedState:"Critical / Debugging"}));await s.run();assert.deepEqual(s.writes.map(write=>write.id),[leaf,child,root]);assert.equal(s.remote.get(root)?.state,"Critical / Debugging");
  await s.store.change(data=>editTask(data,leaf,{assignedState:"Done"}));await s.run();assert.equal(s.remote.get(root)?.state,"In Development");assert.equal(s.remote.get(child)?.state,"Done");
});
test("external native State edits become assignments and conflict with a different pending choice",async()=>{
  const s=await setup([task(root,"Done",null,"Standby"),task(child,"Done",root)]);
  await s.store.change(data=>editTask(data,root,{assignedState:"In Development"}));Object.assign(s.remote.get(root)!,{state:"Critical / Debugging",updated:2});await assert.rejects(s.run(),/conflicting/);assert.equal(s.writes.length,0);assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Critical / Debugging");
  await s.review("local");await s.run();assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"In Development");assert.equal(s.remote.get(root)?.state,"Done");
  await s.store.change(data=>deleteTask(data,child));await s.run();assert.equal(s.remote.get(root)?.state,"In Development");
});
test("accepted rollup timeout survives restart and requires confirmation without a resend",async()=>{
  const s=await setup([task(root),task(child,"To do",root)]);s.options.lost=true;await s.store.change(data=>editTask(data,child,{assignedState:"Done"}));await assert.rejects(s.run(),/uncertain/);assert.equal(s.writes.length,1);assert.equal(s.saved().operations[0]?.type,"edit");assert.equal(s.saved().cloud?.assigned?.[child]?.pendingState,"Done");
  const restored=new WorkspaceStore(s.persistence);await restored.start();await assert.rejects(s.run(restored),/uncertain/);assert.equal(s.writes.length,1);await assert.rejects(s.review("local",restored),/Only an edit/);await s.review("confirm",restored);assert.equal(s.saved().cloud?.assigned?.[child]?.assignedState,"Done");await s.run(restored);assert.deepEqual(s.writes.map(write=>write.id),[child,root]);
});
test("an uncertain parent rollup never becomes a new assignment on readback",async()=>{
  const s=await setup([task(root,"To do",null,"Standby"),task(child,"Done",root)]);s.options.lost=true;await s.store.change(data=>editTask(data,root,{assignedState:"In Development"}));await assert.rejects(s.run(),/uncertain/);assert.equal(s.remote.get(root)?.state,"Done");await s.review("confirm");assert.equal(s.saved().remote.find(item=>item.id===root)?.assignedState,"In Development");await s.run();await s.store.change(data=>deleteTask(data,child));await s.run();assert.equal(s.remote.get(root)?.state,"In Development");
});
test("durable assignment and rollup debt resume after a failed project read with an empty user queue",async()=>{
  const s=await setup([task(root)]);s.options.allOffline=true;await s.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(s.run(),/offline/);assert.equal(s.saved().operations.length,0);assert.equal(s.saved().cloud?.rollupPending,true);assert.equal(s.writes.length,0);const restored=new WorkspaceStore(s.persistence);await restored.start();s.options.allOffline=false;await s.run(restored);assert.equal(s.remote.get(root)?.state,"Done");assert.equal(s.saved().cloud?.rollupPending,false);
});
test("a failed durable rollup marker prevents native writes while retaining the assignment",async()=>{
  const s=await setup([task(root)]);s.options.disk=true;await s.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(s.run(),/disk full/);assert.equal(s.writes.length,0);assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Done");assert.equal(s.saved().cloud?.assigned?.[root]?.pendingState,null);
});
test("missing project tasks, external parents and undiscovered children block every rollup POST",async()=>{
  for(const kind of ["missing","child","external","cycle"]){const s=await setup([task(root),task(child,"Done",root)]);await s.store.change(data=>editTask(data,root,{assignedState:"Standby"}));if(kind==="missing")s.options.omit=child;if(kind==="child")s.options.extraChild="PMON-999999";if(kind==="external")s.remote.get(root)!.parentId="OTHER-1";if(kind==="cycle")s.remote.get(root)!.parentId=child;await assert.rejects(s.run(),/missing|hierarchy|children|cycle/);assert.equal(s.writes.length,0);assert.equal(s.saved().cloud?.rollupPending,true);}
});
test("rollups recheck the target before POST and stale observations cannot change assignments",async()=>{
  const s=await setup([task(root)]);const get=s.port.get;s.port.get=async id=>{const item=await get(id);if(item)item.updated=99;return item;};await s.store.change(data=>editTask(data,root,{assignedState:"Done"}));await assert.rejects(s.run(),/older|changed/);assert.equal(s.writes.length,0);
  const data=emptyWorkspace();data.remote=[task(root)];seedAssigned(data);observeStatus(data,{...task(root,"Done"),updated:2});assert.throws(()=>observeStatus(data,task(root)),/older/);assert.equal(data.cloud?.assigned?.[root]?.assignedState,"Done");
});
test("corrupt assignment maps, unjournaled pending writes and invalid rollup patches block load",async()=>{
  const s=await setup([task(root)]);await s.store.change(data=>editTask(data,root,{assignedState:"Done"}));s.options.lost=true;await assert.rejects(s.run(),/uncertain/);const original=s.saved();
  for(const corrupt of [(data:WorkspaceData)=>{data.cloud!.assigned![root]!.assignedState=4 as unknown as string;},(data:WorkspaceData)=>{data.cloud!.assigned![root]!.pendingState="Standby";},(data:WorkspaceData)=>{const op=data.operations[0]!;if(op.type==="edit")op.patch.description="unexpected";},(data:WorkspaceData)=>{data.cloud!.rollupPending=false;}]){const data=structuredClone(original);corrupt(data);assert.throws(()=>validateWorkspace(data),/invalid/);}
});
test("a mixed-field timeout can be confirmed without losing its saved assignment",async()=>{
  const s=await setup([task(root)]);await s.store.change(data=>editTask(data,root,{description:"Local notes",assignedState:"Done"}));s.options.lost=true;await assert.rejects(s.run(),/uncertain/);assert.equal(s.remote.get(root)?.state,"To do");await s.review("confirm");assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Done");await s.run();assert.equal(s.remote.get(root)?.state,"Done");assert.equal(s.writes.length,2);
});

test("parent State delivery matches every accepted rollup color",async()=>{
  for(const [states,expected] of [[['To do','To do'],'To do'],[['Done','To do'],'In Progress'],[['Done','Standby'],'Standby'],[['Done','Done'],'Done'],[['Critical / Debugging','In Development'],'Critical / Debugging'],[['In Development','Standby'],'In Development']] as const){const s=await setup([task(root),task(child,states[0],root),task(other,states[1],root)]);await s.store.change(data=>editTask(data,root,{assignedState:"Standby"}));await s.run();assert.equal(s.remote.get(root)?.state,expected);assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"Standby");}
});

test("legacy state aliases deliver as assignments while parent effective State remains derived",async()=>{
  const s=await setup([task(root),task(child,"Done",root)]);await s.store.change(data=>editTask(data,root,{state:"In Development",assignedState:"In Development"}));await s.run();assert.equal(s.remote.get(root)?.state,"Done");assert.equal(s.saved().cloud?.assigned?.[root]?.assignedState,"In Development");assert.equal(s.writes.length,1);
});

test("a resumed rollup yields to a newly changed deeper subtree before checking its own children",async()=>{
  const middle="PMON-900004",leaf="PMON-900005";
  const s=await setup([task(root),task(child,"Done",root),task(other),task(middle,"To do",other),task(leaf,"To do",middle)]);
  const get=s.port.get;let stop=true;s.port.get=async id=>{const item=await get(id);const op=s.store.getSnapshot().data.operations[0];if(stop&&op?.type==="edit"&&op.purpose==="rollup"){stop=false;if(item)item.updated=99;}return item;};
  await s.store.change(data=>editTask(data,root,{assignedState:"In Development"}));await assert.rejects(s.run(),/target changed/);assert.equal(s.writes.length,0);
  Object.assign(s.remote.get(leaf)!,{state:"Done",updated:2});s.options.extraChild="PMON-999999";await assert.rejects(s.run(),/unreadable children/);assert.deepEqual(s.writes.map(write=>write.id),[middle]);assert.equal(s.remote.get(root)?.state,"To do");
});
