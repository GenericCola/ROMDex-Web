import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import {WorkspaceStore} from "../../src/domain/workspace-store";
import type {WorkspaceData} from "../../src/domain/types";
import {createTask,editTask,deleteTask,postComment} from "../../src/domain/task-actions";
import {indexTree,materialize,reconcile} from "../../src/domain/accepted/core.mjs";
test("accepted hierarchy and rollups survive task creation and reparent rejection",()=>{const data=emptyWorkspace();const root=createTask(data,null,"Epic");const child=createTask(data,root,"Saga");editTask(data,child,{state:"In Development",assignedState:"In Development"});let tasks=materialize(data.remote,data.operations);assert.equal(indexTree(tasks).colors.get(root),"purple");assert.throws(()=>editTask(data,root,{parentId:child}),/descendants/);editTask(data,child,{state:"Critical / Debugging",assignedState:"Critical / Debugging"});tasks=materialize(data.remote,data.operations);assert.equal(indexTree(tasks).colors.get(root),"red");deleteTask(data,root);assert.equal(materialize(data.remote,data.operations).length,0);});
test("remote edit baselines are preserved for conflict review",()=>{const data=emptyWorkspace();const id=createTask(data,null,"Original");data.remote=materialize([],data.operations);data.operations=[];editTask(data,id,{summary:"Local"});editTask(data,id,{description:"Notes"});const operation=data.operations[0];assert.equal(operation?.type,"edit");if(operation?.type!=="edit")throw Error("Missing edit");assert.equal(operation.base.summary,"Original");const remote={...operation.base,summary:"Remote"};assert.equal(reconcile(operation.base,operation.patch,remote).conflicts[0]?.field,"summary");});
test("comment posting consumes only that item's durable draft",()=>{const data=emptyWorkspace();const id=createTask(data,null,"Task");data.commentDrafts[id]=" Draft comment ";data.commentDrafts.other="Keep";postComment(data,id);assert.equal(data.commentDrafts[id],undefined);assert.equal(data.commentDrafts.other,"Keep");assert.equal(data.operations.at(-1)?.type,"comment");});
test("workspace serializes durable writes and waits before update activation",async()=>{let record:{data:WorkspaceData;revision:number}|undefined;const writes:number[]=[];const storage={load:async()=>record,save:async(data:WorkspaceData,revision:number)=>{assert.equal(revision,record?.revision??0);writes.push(revision);record={data:structuredClone(data),revision:revision+1};return revision+1;}};const store=new WorkspaceStore(storage);await store.start();void store.change(data=>{data.commentDrafts.a="first";});void store.change(data=>{data.commentDrafts.a="latest";});await store.flush();assert.deepEqual(writes,[0,1]);assert.equal(record?.data.commentDrafts.a,"latest");assert.equal(store.getSnapshot().pendingWrites,0);});
test("failed saves keep in-memory recovery data and block updates",async()=>{const store=new WorkspaceStore({load:async()=>undefined,save:async()=>{throw Error("Quota exceeded");}});await store.start();await store.change(data=>{data.commentDrafts.a="Unsaved recovery text";});await assert.rejects(store.flush(),/Quota/);assert.match(store.recover(),/Unsaved recovery text/);assert.throws(()=>store.change(()=>undefined),/Quota/);});
test("failed loads never replace existing storage with an empty workspace",async()=>{let saved=false;const store=new WorkspaceStore({load:async()=>{throw Error("Unreadable workspace");},save:async()=>{saved=true;return 1;}});await store.start();assert.equal(store.getSnapshot().ready,false);assert.throws(()=>store.change(()=>undefined),/Unreadable/);assert.equal(saved,false);});

test("update preparation locks editing, saves drafts, and releases after refusal",async()=>{
  const store=new WorkspaceStore({load:async()=>undefined,save:async(_data,revision)=>revision+1});
  await store.start();void store.change(data=>{data.commentDrafts.a="latest draft";});
  const preparing=store.prepareUpdate();assert.equal(store.getSnapshot().updating,true);
  assert.throws(()=>store.change(()=>undefined),/update/);
  const release=await preparing;assert.equal(store.getSnapshot().pendingWrites,0);
  release();await store.change(data=>{data.commentDrafts.a="editable again";});
  assert.equal(store.getSnapshot().updating,false);
});
test("failed draft saving cancels the update lock",async()=>{
  const store=new WorkspaceStore({load:async()=>undefined,save:async()=>{throw Error("Disk full");}});
  await store.start();void store.change(data=>{data.commentDrafts.a="recover me";});
  await assert.rejects(store.prepareUpdate(),/Disk full/);assert.equal(store.getSnapshot().updating,false);assert.match(store.recover(),/recover me/);
});
