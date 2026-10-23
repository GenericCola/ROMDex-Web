import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {inspectRdx} from "../../src/rdx/inspect";
import {readRdx,writeRdx,documentRevision} from "../../src/rdx/container";
import {rdxFile,retainRdx,fileBytes,validateRdxFiles} from "../../src/rdx/library";
import {verifyRetainedAssets} from "../../src/migration/verify-assets";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import {jsonObject} from "../../src/domain/json";
import {planDocument} from "../fixtures/rdx";
const fixture=(name:string)=>{return readFile(new URL("../fixtures/"+name,import.meta.url));};
test("untouched desktop golden map and plan retain assets, revisions and exact container bytes",async()=>{
 for(const name of ["native-map.rdx","native-plan.rdx"]){
  const bytes=await fixture(name),parsed=await readRdx(bytes),value=await inspectRdx({action:"inspect",bytes});
  assert.deepEqual(value.document,parsed.document);assert.ok(parsed.blobs.size>0);
  const file=rdxFile(name,value),data=emptyWorkspace();retainRdx(data,file,null);validateRdxFiles(data);await verifyRetainedAssets(data);assert.deepEqual(Buffer.from(fileBytes(file)),bytes);
  if(name==="native-map.rdx"){assert.ok(value.projection,value.projectionError);assert.equal(value.projection?.contentRevision,parsed.document.revision);}
 }
});
test("plan merge requires an observed conflict choice and retains the exact imported document in history",async()=>{
 const a=planDocument(),b=structuredClone(a),content=jsonObject(b.content),task=jsonObject((content.tasks as unknown[])[0] as never);task.title="Incoming change";b.revision=documentRevision(b);
 const local=await writeRdx(a,new Map()),bytes=await writeRdx(b,new Map());
 const preview=await inspectRdx({action:"merge",bytes,local,choices:{}});assert.match(preview.projectionError,/every conflict/);
 const merged=await inspectRdx({action:"merge",bytes,local,choices:{"task:fixture":"incoming"}}),parsed=await readRdx(merged.bytes);
 assert.equal(jsonObject((jsonObject(parsed.document.content).tasks as never[])[0]).title,"Incoming change");assert.equal(parsed.blobs.size,1);assert.equal((jsonObject(parsed.document.content).history as unknown[]).length,1);
});
test("stale library saves and corrupted recovery assets cannot replace a document head",async()=>{
 const bytes=await writeRdx(planDocument(),new Map()),value=await inspectRdx({action:"inspect",bytes}),file=rdxFile("test.rdx",value),data=emptyWorkspace();
 retainRdx(data,file,null);assert.throws(()=>retainRdx(data,file,null),/changed after preview/);
 data.rdxFiles![0]!.sha256="0".repeat(64);await assert.rejects(verifyRetainedAssets(data),/checksum/);
});
