import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyWorkspace,validateWorkspace} from "../../src/domain/workspace-data";
import {contentTarget,saveNpcdexDraft,targetKey} from "../../src/npcdex/model";
import {validateNpcdex} from "../../src/npcdex/validate";
import {base64Bytes} from "../../src/domain/json";
import {registerDraftEditor,hasDraftEdits,flushDraftEditors} from "../../src/domain/editor-drafts";
import {WorkspaceStore} from "../../src/domain/workspace-store";
const document=()=>({version:2,revision:4,towns:[{id:"map",name:"Synthetic map",areas:[{id:"area",name:"Synthetic area",elements:[{id:"actor",name:"Synthetic actor",points:[{id:"point",condition:"Synthetic condition",stages:["A"],blocks:[{id:"block",type:"dialogue",text:"Current dialogue"}]}]}]}]}],annotations:{"point:point":{testStatus:"tested",evidence:"human source evidence"}},unknownExtension:{preserve:"yes"}});
const target={town:"map",area:"area",element:"actor",point:"point",block:"block"};

test("NPCDex planning keeps exact current dialogue, unknown fields and testing evidence apart from drafts",()=>{
  const data=emptyWorkspace();data.npcdex=document();const original=JSON.stringify(data.npcdex);validateNpcdex(data.npcdex);
  saveNpcdexDraft(data,{target,sourceRevision:"4",note:"Feedback",intent:"Change dialogue",instructions:"Review first",proposedText:"Proposed dialogue",flag:"flagged",updatedAt:"2026-10-22"});validateWorkspace(data);
  assert.equal(JSON.stringify(data.npcdex),original);assert.equal(contentTarget(data.npcdex,target).block?.text,"Current dialogue");assert.equal(data.npcdexDrafts?.[targetKey(target)]?.proposedText,"Proposed dialogue");assert.equal(data.npcdexHistory?.length,1);
});

test("stale NPCDex revisions, missing targets and duplicate identities cannot replace source content",()=>{
  const data=emptyWorkspace();data.npcdex=document();const draft={target,sourceRevision:"3",note:"",intent:"",instructions:"",proposedText:"",flag:"none" as const,updatedAt:"now"};assert.throws(()=>saveNpcdexDraft(data,draft),/changed/);assert.throws(()=>saveNpcdexDraft(data,{...draft,sourceRevision:"4",target:{...target,block:"missing"}}),/no longer exists/);
  const duplicate=document();duplicate.towns.push(structuredClone(duplicate.towns[0]!));assert.throws(()=>validateNpcdex(duplicate),/duplicate/);assert.equal(data.npcdexHistory,undefined);
});

test("PWA update preparation flushes registered NPCDex editors before locking and refuses failed editor saves",async()=>{
  let saved=emptyWorkspace(),revision=0;const store=new WorkspaceStore({load:async()=>({data:saved,revision}),save:async(data,expected)=>{assert.equal(expected,revision);saved=structuredClone(data);return ++revision;}});await store.start();
  let dirty=true;const unregister=registerDraftEditor({dirty:()=>dirty,flush:async()=>{await store.change(data=>{data.view.search="editor checkpoint";});dirty=false;}});
  try{assert.equal(hasDraftEdits(),true);const release=await store.prepareUpdate();assert.equal(saved.view.search,"editor checkpoint");assert.equal(store.getSnapshot().updating,true);assert.equal(hasDraftEdits(),false);release();}finally{unregister();}
  const remove=registerDraftEditor({dirty:()=>true,flush:async()=>{throw Error("editor disk failure");}});
  try{await assert.rejects(store.prepareUpdate(),/disk failure/);assert.equal(store.getSnapshot().updating,false);}finally{remove();}
  await flushDraftEditors();assert.equal(hasDraftEdits(),false);
});

test("large desktop image base64 decodes without recursive-regexp stack growth",()=>{
  const bytes=Buffer.alloc(1024*1024,37);assert.deepEqual(Buffer.from(base64Bytes(bytes.toString("base64"))),bytes);assert.throws(()=>base64Bytes("A==="));
});


test("failed storage still exports unsaved editor text for reviewed recovery",async()=>{
 const store=new WorkspaceStore({load:async()=>undefined,save:async()=>{throw Error("quota failure");}});await store.start();
 const draft={target,sourceRevision:"4",note:"Editor-only recovery note",intent:"",instructions:"",proposedText:"Recover this uncommitted dialogue",flag:"none",updatedAt:""};
 const remove=registerDraftEditor({dirty:()=>true,flush:async()=>{throw Error("quota failure");},capture:()=>({id:"fixture-editor",kind:"NPCDexDraft",draft})});
 try{await assert.rejects(store.prepareUpdate(),/quota/);const recovery=JSON.parse(store.recover());assert.equal(recovery.data.editorRecovery[0].draft.proposedText,draft.proposedText);validateWorkspace(recovery.data);}finally{remove();}
});
