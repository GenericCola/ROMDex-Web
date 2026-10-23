import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {runInNewContext} from "node:vm";
import {crc32} from "node:zlib";
import {readFile,mkdtemp,mkdir} from "node:fs/promises";
import {buildYouTrackArchive,writeFrozen} from "../../scripts/package-youtrack.mjs";
import {archive,archiveFiles,createBackend,mountPanel} from "./fixture.mjs";

test("both archives load with exports-only globals and utility source is shared",async()=>{
 for(const acceptance of [false,true]){
  const built=await buildYouTrackArchive({acceptance});let at=0,count=0;
  while(built.zip.readUInt32LE(at)===0x04034b50){
   const length=built.zip.readUInt16LE(at+26),size=built.zip.readUInt32LE(at+18),name=built.zip.subarray(at+30,at+30+length).toString(),data=built.zip.subarray(at+30+length,at+30+length+size);
   assert.equal(crc32(data),built.zip.readUInt32LE(at+14));assert.ok(!name.includes(".."));if(name==="manifest.json"){const manifest=JSON.parse(data);assert.equal(manifest.name,acceptance?"romdex-status-acceptance":"romdex-status");if(!acceptance)assert.equal("widgets" in manifest,false);}
   at+=30+length+size;count++;
  }
  assert.equal(count,acceptance?9:6);assert.equal(built.zip.readUInt32LE(at),0x02014b50);assert.equal(built.checksum,createHash("sha256").update(built.zip).digest("hex"));
  assert.deepEqual((await buildYouTrackArchive({acceptance})).zip,built.zip);
 }
 const server=createBackend();server.load("./status");server.load("./fault");server.load("./capabilities");
 for(const name of ["status-record.js","status-rules.js"])assert.equal(archiveFiles.get(name),await readFile("youtrack-app/"+name,"utf8"));
});
test("all widget assets resolve inside the exact archive and only the original extension property exists",()=>{
 const manifest=JSON.parse(archiveFiles.get("manifest.json"));
 for(const widget of manifest.widgets){assert.ok(archiveFiles.has("widgets/"+widget.indexPath));}
 assert.ok(archiveFiles.has("widgets/acceptance/panel.js"));assert.ok(!archiveFiles.has("acceptance/index.html"));
 assert.deepEqual(JSON.parse(archiveFiles.get("entity-extensions.json")),{entityTypeExtensions:[{entityType:"Issue",properties:{assignedStatus:{type:"string"}}}]});
});
test("a differing archive cannot overwrite its version",async()=>{
 await mkdir(new URL("../../artifacts/youtrack-qa/",import.meta.url),{recursive:true});
 const directory=await mkdtemp("artifacts/youtrack-qa/immutable-"),name=directory.slice("artifacts/".length)+"/probe.zip";
 await writeFrozen(name,Buffer.from("first"));await writeFrozen(name,Buffer.from("first"));
 await assert.rejects(writeFrozen(name,Buffer.from("second")),/Refusing to overwrite/);assert.equal(await readFile("artifacts/"+name,"utf8"),"first");
});
test("acceptance allowlist and summary guard refuse foreign issues before storage access",()=>{
 for(const patch of [{id:"NPCD-874"},{id:"PMON-872"},{summary:"Existing NPCD task"}]){
  const s=createBackend();Object.assign(s.tasks.get("NPCD-872"),patch);
  assert.equal(s.dispatch("status/assigned",{scope:true}).status,403);assert.equal(s.commits.length,0);
 }
});

test("the earlier Node-only exports and missing SDK options are caught by executable regressions",async()=>{
 for(const name of ["status-record.js","status-rules.js"]){
  const broken=archiveFiles.get(name).replace("Object.assign(exports, {","module.exports = {").trimEnd().slice(0,-3)+"};";
  assert.throws(()=>runInNewContext(broken,{exports:{}},{filename:name}),/module is not defined/);
 }
 const current=archiveFiles.get("widgets/acceptance/panel.js"),broken=current.replace('host.fetchApp("capabilities/check", { scope: false })','host.fetchApp("capabilities/check")');
 assert.notEqual(broken,current);
 const server=createBackend(),panel=await mountPanel(server,{source:broken});
 assert.match(await panel.click("run"),/FAIL Deployed SDK requires explicit scope options/);assert.equal(server.commits.length,0);
});
