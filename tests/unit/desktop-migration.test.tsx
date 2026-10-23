import {readMigrationText} from "../../src/migration/file-text";
import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, writeFile, readFile, rm} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {emptyWorkspace,validateWorkspace} from "../../src/domain/workspace-data";
import {parseJson} from "../../src/domain/json";
import {readDesktopExport} from "../../src/migration/desktop-export";
import {previewDesktop,applyDesktop} from "../../src/migration/desktop";
import type {TaskItem} from "../../src/domain/types";
const task:TaskItem={id:"PMON-900001",summary:"Synthetic root",description:"",parentId:null,state:"Done",priority:"Normal",complexity:null,type:"Epic",updated:1,comments:[],commentCount:0};
const encode=(name:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value));return {name,data:bytes.toString("base64"),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};};
const bundle=()=>({format:"ROMDexDesktopExport/1",exportedAt:"2026-10-22",files:[encode("desktop-workspace.json",{version:1,remote:[task],operations:[{type:"edit",issueId:task.id,patch:{summary:"Pending desktop edit"}}],order:{[task.id]:0},images:{}}),encode("assigned-statuses.json",{[task.id]:{assignedState:"Standby",lastState:"Done",lastUpdated:1}}),encode("npcdex-current.json",{version:2,towns:[],history:[{customEvidence:"preserve exactly"}],unknownFutureField:{keep:true}})]});

test("strict migration JSON rejects duplicate keys, reserved keys, invalid Unicode and trailing bytes",()=>{
  for(const text of ['{"x":1,"x":2}','{"__proto__":{}}','"\\ud800"','[1] false','9007199254740993'])assert.throws(()=>parseJson(text));
  assert.deepEqual(parseJson('{"coordinate":1.25,"text":"kept"}'),{coordinate:1.25,text:"kept"});
});

test("desktop export integrity and credential allowlist fail before any browser change",async()=>{
  const bad=bundle();bad.files[0]!.sha256="0".repeat(64);await assert.rejects(readDesktopExport(JSON.stringify(bad)),/integrity/);
  const credential=bundle();credential.files.push(encode("connection.encrypted","not a permitted file"));await assert.rejects(readDesktopExport(JSON.stringify(credential)),/unapproved/);
});

test("desktop import preserves own status, unknown content and pending actions without resuming them",async()=>{
  const archive=await readDesktopExport(JSON.stringify(bundle())),data=emptyWorkspace();
  const preview=previewDesktop(archive,data);applyDesktop(data,preview,new Set());validateWorkspace(data);
  assert.equal(data.remote[0]?.assignedState,"Standby");assert.equal(data.operations.length,0);assert.equal(data.migration?.pending.length,1);assert.equal(data.cloud?.autoSync,false);assert.equal(data.cloud?.rollupPending,false);
  assert.deepEqual(data.npcdex?.unknownFutureField,{keep:true});assert.equal(data.migration?.archive.files.length,3);
});

test("newer web status is preserved unless its exact desktop conflict is selected",async()=>{
  const archive=await readDesktopExport(JSON.stringify(bundle())),data=emptyWorkspace();data.remote=[{...task,updated:2,assignedState:"Critical / Debugging"}];
  let preview=previewDesktop(archive,data);assert.equal(preview.choices[0]?.conflict,true);applyDesktop(data,preview,new Set());assert.equal(data.remote[0]?.assignedState,"Critical / Debugging");
  const chosen=emptyWorkspace();chosen.remote=[{...task,updated:2,assignedState:"Critical / Debugging"}];preview=previewDesktop(archive,chosen);applyDesktop(chosen,preview,new Set([task.id]));assert.equal(chosen.remote[0]?.assignedState,"Standby");
});

test("stale migration preview and an existing browser queue block replacement",async()=>{
  const archive=await readDesktopExport(JSON.stringify(bundle())),data=emptyWorkspace(),preview=previewDesktop(archive,data);data.view.search="changed";assert.throws(()=>applyDesktop(data,preview,new Set()),/changed after preview/);
  data.operations=[{type:"comment",issueId:task.id,opId:"kept",text:"browser draft",created:1}];assert.throws(()=>previewDesktop(archive,data),/Finish or export/);
});

test("desktop export script copies approved bytes only and refuses a second write or a live desktop owner",async()=>{
  const temp=path.resolve(os.tmpdir()),directory=await mkdtemp(path.join(temp,"romdex-export-test-"));assert.equal(path.dirname(directory),temp);
  try{
    const profile=path.join(directory,"profile"),output=path.join(directory,"export.json");await mkdir(path.join(profile,"service"),{recursive:true});await writeFile(path.join(profile,"service/desktop-workspace.json"),JSON.stringify({version:1,remote:[task],operations:[]}));await writeFile(path.join(profile,"service/connection.encrypted"),"synthetic credential must remain excluded");
    await mkdir(path.join(profile,"RDX/working"),{recursive:true});await writeFile(path.join(profile,"RDX/working", "a".repeat(64)+".rdx"),"synthetic preserved container bytes");
    await mkdir(path.join(profile,"service/queued-files/uploads"),{recursive:true});await writeFile(path.join(profile,"service/queued-files/uploads/upload-test.bin"),"synthetic pending file");
    const script=path.resolve("scripts/export-desktop.mjs");execFileSync(process.execPath,[script,profile,output]);const exported=await readDesktopExport(await readFile(output,"utf8"));assert.deepEqual(exported.files.map(f=>f.name),["desktop-workspace.json","RDX/working/"+"a".repeat(64)+".rdx","queued-files/uploads/upload-test.bin"]);assert.throws(()=>execFileSync(process.execPath,[script,profile,output],{stdio:"pipe"}));
    await writeFile(path.join(profile,"desktop-owner.json"),JSON.stringify({pid:process.pid}));assert.throws(()=>execFileSync(process.execPath,[script,profile,path.join(directory,"live.json")],{stdio:"pipe"}));
  }finally{assert.equal(path.dirname(directory),temp);await rm(directory,{recursive:true,force:true});}
});


test("desktop source replacement archives preceding NPCDex drafts and rejects invalid UTF-8",async()=>{
 const archive=await readDesktopExport(JSON.stringify(bundle())),data=emptyWorkspace();data.npcdex={version:2,towns:[]};data.npcdexDrafts={};data.npcdexHistory=[{id:"previous-history"}];data.editorRecovery=[{id:"previous-editor",kind:"other"}];const preview=previewDesktop(archive,data);applyDesktop(data,preview,new Set());assert.deepEqual(data.npcdexHistory,[]);assert.equal(data.editorRecovery,undefined);assert.deepEqual(data.migration?.previousBrowser.npcdexHistory,[{id:"previous-history"}]);await assert.rejects(readMigrationText(new Blob([Uint8Array.from([0xff])])),/valid UTF-8/);
});


test("recovery refuses malformed layout values and links outside the verified YouTrack task",()=>{
 const data=emptyWorkspace();data.view.workHeight=Number.NaN;assert.throws(()=>validateWorkspace(data),/layout or draft/);data.view.workHeight=46;data.remote=[{...task,url:"javascript:alert(1)"}];assert.throws(()=>validateWorkspace(data),/verified YouTrack/);data.remote[0]!.url="https://thegobindsingh.youtrack.cloud/issue/"+task.id;assert.doesNotThrow(()=>validateWorkspace(data));
});
