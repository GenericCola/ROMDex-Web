import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyWorkspace,validateWorkspace} from "../../src/domain/workspace-data";
import {exportWorkspace} from "../../src/domain/workspace-recovery";
import type {TaskItem,WorkspaceData} from "../../src/domain/types";
import type {Commit,DeliveryPort} from "../../src/cloud/types";
import type {Attachment,StoredUpload,UploadStore} from "../../src/attachments/types";
import {queueUpload,queueAttachmentDelete} from "../../src/attachments/actions";
import {stagedFile,verifyUpload,sameUploadFile} from "../../src/attachments/validate";
import {recoveryWithUploads,readRecoveryUploads,stageRecoveryUploads} from "../../src/attachments/recovery";
import {deliverQueue} from "../../src/cloud/delivery";
import {reviewQueue} from "../../src/cloud/review";
const task:TaskItem={id:"PMON-900001",summary:"Attachment fixture",description:"",parentId:null,state:"To do",priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0};
const memory=()=>{const values=new Map<string,StoredUpload>();const storage:UploadStore={put:async value=>{await verifyUpload(value);const old=values.get(value.id);if(old&&!sameUploadFile(old.file,value.file))throw Error("immutable ID");values.set(value.id,value);},get:async id=>{const value=values.get(id);return value?verifyUpload(value):undefined;},remove:async id=>{values.delete(id);}};return {values,storage};};
const setup=async(options:{lostUpload?:boolean;lostDelete?:boolean;failedMarker?:boolean}={})=>{
 let data=emptyWorkspace();data.remote=[structuredClone(task)];data.cloud={autoSync:false,records:{},accountId:"fixture-owner"};
 const cache=memory(),value=await stagedFile("upload-fixture",new File(["verified attachment bytes"],"fixture.txt",{type:"text/plain"}));await cache.storage.put(value);queueUpload(data,task.id,value.id,value.file);
 const files=new Map<string,Attachment>(),bytes=new Map<string,Uint8Array>();let uploads=0,deletions=0;
 const commit:Commit=async update=>{const next=structuredClone(data);update(next);validateWorkspace(next);if(options.failedMarker&&Object.values(next.cloud?.records??{}).some(record=>record.status==="attempting"))throw Error("journal disk failure");data=next;};
 const port:DeliveryPort&{verifyComment:(...args:string[])=>Promise<void>}={accountId:"fixture-owner",all:async()=>[structuredClone(task)],get:async()=>structuredClone(task),update:async()=>undefined,comment:async()=>({id:"unused"}),create:async()=>({id:"unused"}),prepareCreate:async()=>undefined,remove:async()=>undefined,children:async()=>[],verifyComment:async()=>undefined,files:{
  list:async()=>[...files.values()].map(file=>structuredClone(file)),
  upload:async(_issue,record)=>{assert.equal(data.cloud?.records[value.id]?.status,"attempting");assert.ok(cache.values.has(value.id));uploads++;const id="134-"+uploads;files.set(id,{id,name:record.file.name,size:record.file.size,mimeType:record.file.mimeType,created:1,updated:1,authorId:"fixture-owner"});bytes.set(id,new Uint8Array(await record.blob.arrayBuffer()));if(options.lostUpload)throw Error("accepted response lost");return {id};},
  download:async(_issue,file)=>bytes.get(file.id)??new Uint8Array(),
  remove:async(_issue,id)=>{deletions++;files.delete(id);if(options.lostDelete)throw Error("delete response lost");}
 }};
 const run=()=>deliverQueue(()=>data,commit,port,cache.storage);
 return {data:()=>data,commit,port,cache,value,files,bytes,run,uploads:()=>uploads,deletions:()=>deletions};
};
test("attachment bytes and attempt are durable before upload; exact receipt and hash precede acknowledgement",async()=>{
 const s=await setup();await s.run();assert.equal(s.uploads(),1);assert.equal(s.data().operations.length,0);assert.equal(s.data().attachmentLists?.[task.id]?.[0]?.id,"134-1");assert.equal(s.data().cloud?.records[s.value.id]?.status,"confirmed");assert.equal(s.cache.values.size,0);
});
test("failed file attempt journal prevents all upload mutations",async()=>{
 const s=await setup({failedMarker:true});await assert.rejects(s.run(),/disk failure/);assert.equal(s.uploads(),0);assert.equal(s.cache.values.size,1);assert.equal(s.data().operations.length,1);
});
test("lost upload receipt survives restart and requires exact new ID and bytes, never another upload",async()=>{
 const s=await setup({lostUpload:true});await assert.rejects(s.run(),/uncertain/);const restored=JSON.parse(JSON.stringify(s.data()));validateWorkspace(restored);assert.deepEqual(restored.cloud.records[s.value.id].attachmentBeforeIds,[]);await assert.rejects(s.run(),/uncertain/);assert.equal(s.uploads(),1);
 await assert.rejects(reviewQueue(s.data(),s.commit,s.port,s.value.id,"confirm","missing",false,s.cache.storage),/exact attachment/);
 s.bytes.set("134-1",new TextEncoder().encode("wrong bytes"));await assert.rejects(reviewQueue(s.data(),s.commit,s.port,s.value.id,"confirm","134-1",false,s.cache.storage),/do not match/);s.bytes.set("134-1",new Uint8Array(await s.value.blob.arrayBuffer()));
 await reviewQueue(s.data(),s.commit,s.port,s.value.id,"confirm","134-1",false,s.cache.storage);assert.equal(s.uploads(),1);assert.equal(s.data().operations.length,0);assert.equal(s.cache.values.size,0);
});
test("an already-existing receipt and a changed author cannot acknowledge an uncertain upload",async()=>{
 const s=await setup({lostUpload:true});const old={id:"134-0",name:s.value.file.name,size:s.value.file.size,mimeType:"text/plain",created:1,updated:1,authorId:"fixture-owner"};s.files.set(old.id,old);s.bytes.set(old.id,new Uint8Array(await s.value.blob.arrayBuffer()));await assert.rejects(s.run(),/uncertain/);await assert.rejects(reviewQueue(s.data(),s.commit,s.port,s.value.id,"confirm","134-0",false,s.cache.storage),/exact new/);s.files.get("134-1")!.authorId="other-owner";await assert.rejects(reviewQueue(s.data(),s.commit,s.port,s.value.id,"confirm","134-1",false,s.cache.storage),/account/);assert.equal(s.uploads(),1);
});
test("changed attachment deletion baseline sends nothing and retains the exact request for review",async()=>{
 const s=await setup();await s.run();const file=s.files.get("134-1")!;await s.commit(data=>queueAttachmentDelete(data,task.id,file));file.updated=2;await assert.rejects(s.run(),/changed attachment/);assert.equal(s.deletions(),0);assert.equal(s.data().operations[0]?.type,"attachment-delete");assert.equal(s.data().cloud?.records[s.data().operations[0]!.opId]?.status,"conflict");
});
test("lost attachment deletion is confirmed only with explicit missing/access acknowledgement and no resend",async()=>{
 const s=await setup({lostDelete:true});await s.run();await s.commit(data=>queueAttachmentDelete(data,task.id,s.files.get("134-1")!));const id=s.data().operations[0]!.opId;await assert.rejects(s.run(),/uncertain/);await assert.rejects(s.run(),/uncertain/);assert.equal(s.deletions(),1);await assert.rejects(reviewQueue(s.data(),s.commit,s.port,id,"confirm","",false,s.cache.storage),/Acknowledge/);await reviewQueue(s.data(),s.commit,s.port,id,"confirm","",true,s.cache.storage);assert.equal(s.deletions(),1);assert.equal(s.data().operations.length,0);
});
test("recovery transfers exact staged bytes and rejects corruption before staging or changing the queue",async()=>{
 const s=await setup(),root=JSON.parse(await recoveryWithUploads(exportWorkspace(s.data()),s.cache.storage)),target=memory(),files=await readRecoveryUploads(root.uploads,s.data());await stageRecoveryUploads(files,target.storage);assert.equal(new TextDecoder().decode(await target.values.get(s.value.id)!.blob.arrayBuffer()),"verified attachment bytes");root.uploads[0].data=Buffer.from("corrupt").toString("base64");const empty=memory();await assert.rejects(readRecoveryUploads(root.uploads,s.data()),/verification/);assert.equal(empty.values.size,0);assert.equal(s.data().operations.length,1);
});
test("missing staged bytes remain recoverable metadata and cannot cause a network mutation",async()=>{
 const s=await setup();s.cache.values.clear();const copy=JSON.parse(await recoveryWithUploads(exportWorkspace(s.data()),s.cache.storage));assert.deepEqual(copy.missingUploads,[s.value.id]);await assert.rejects(s.run(),/Restore/);assert.equal(s.uploads(),0);const repaired=await stagedFile(s.value.id,new File(["verified attachment bytes"],"different-name.txt"),s.value.file);await s.cache.storage.put(repaired);await assert.rejects(s.run(),/Restore/);assert.equal(s.uploads(),0);assert.equal(s.data().cloud?.records[s.value.id]?.localFileState,"missing");
});

// The tenant limit blocks new uploads without making older recovery records unreadable.
test("10 MiB uploads are allowed; oversized legacy bytes remain recoverable without a delivery attempt",async()=>{
 const {requireCloudUploadSize,CLOUD_UPLOAD_LIMIT}=await import('../../src/attachments/validate');
 assert.doesNotThrow(()=>requireCloudUploadSize(CLOUD_UPLOAD_LIMIT));
 const bytes=new Uint8Array(CLOUD_UPLOAD_LIMIT+1),file=new File([bytes],'legacy-large.bin');
 await assert.rejects(stagedFile('new-large',file),/up to 10 MiB/);
 const expected={name:file.name,size:file.size,mimeType:'application/octet-stream',hash:await (await import('../../src/domain/json')).sha256(bytes)};
 const legacy=await stagedFile('legacy-large',file,expected);await verifyUpload(legacy);
 const s=await setup();await s.commit(data=>{data.operations=[];queueUpload(data,task.id,legacy.id,legacy.file);});await s.cache.storage.put(legacy);
 await assert.rejects(s.run(),/up to 10 MiB/);assert.equal(s.uploads(),0);assert.equal(s.data().cloud?.records[legacy.id],undefined);assert.equal(s.data().operations.length,1);assert.ok(s.cache.values.has(legacy.id));
});

// A hostile attachment URL must never receive the memory-only delivery token.
test('attachment bytes reject foreign origins and credentials before fetch and enforce exact byte counts',async()=>{
 const {attachmentBytes}=await import('../../src/youtrack/attachment-bytes');const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async(input,init)=>{calls++;assert.equal(new URL(String(input)).origin,'https://thegobindsingh.youtrack.cloud');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer fixture-token');assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');return new Response(new Uint8Array([1,2,3]));};const read=attachmentBytes('fixture-token');
 for(const address of ['https://attacker.invalid/api/files/a','https://thegobindsingh.youtrack.cloud.attacker.invalid/api/files/a','https://user:pass@thegobindsingh.youtrack.cloud/api/files/a','/api/users/me'])await assert.rejects(read(address,3),/unapproved/);assert.equal(calls,0);
 assert.deepEqual(await read('/api/files/safe',3),new Uint8Array([1,2,3]));await assert.rejects(read('/api/files/safe',2),/exceed/);await assert.rejects(read('/api/files/safe',4),/count differs/);
 }finally{globalThis.fetch=original;}
});
