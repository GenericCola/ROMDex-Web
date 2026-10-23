import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {crc32} from "node:zlib";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
const {version}=JSON.parse(readFileSync("youtrack-app/manifest.json","utf8"));
const {version:acceptanceVersion}=JSON.parse(readFileSync("youtrack-acceptance/scope.json","utf8"));

test("installable app ZIP contains only the exact backend sources with valid CRCs and deterministic checksum",()=>{
  execFileSync(process.execPath,["scripts/package-youtrack.mjs"],{stdio:"pipe"});const path=`artifacts/romdex-status-${version}.zip`,zip=readFileSync(path);let at=0;const names:string[]=[];
  while(zip.readUInt32LE(at)===0x04034b50){assert.equal(zip.readUInt16LE(at+8),0);const size=zip.readUInt32LE(at+18),length=zip.readUInt16LE(at+26),name=zip.subarray(at+30,at+30+length).toString();names.push(name);const bytes=zip.subarray(at+30+length,at+30+length+size);assert.equal(crc32(bytes),zip.readUInt32LE(at+14));assert.deepEqual(bytes,readFileSync("youtrack-app/"+name));at+=30+length+size;}
  assert.deepEqual(names,["manifest.json","entity-extensions.json","status.js","capabilities.js","status-record.js","status-rules.js"]);assert.equal(zip.readUInt32LE(at),0x02014b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.readUInt16LE(zip.length-12),6);const sum=createHash("sha256").update(zip).digest("hex");assert.equal(readFileSync(path+".sha256","utf8").split(" ")[0],sum);execFileSync(process.execPath,["scripts/package-youtrack.mjs"],{stdio:"pipe"});assert.deepEqual(readFileSync(path),zip);
});

test("acceptance package isolates the two explicitly authorized NPCD fixtures and rejects production",()=>{
  execFileSync(process.execPath,["scripts/package-youtrack.mjs","--acceptance"],{stdio:"pipe"});
  const zip=readFileSync(`artifacts/romdex-status-acceptance-${acceptanceVersion}.zip`),files=new Map<string,Buffer>();let at=0;
  while(zip.readUInt32LE(at)===0x04034b50){const size=zip.readUInt32LE(at+18),length=zip.readUInt16LE(at+26),name=zip.subarray(at+30,at+30+length).toString();files.set(name,zip.subarray(at+30+length,at+30+length+size));at+=30+length+size;}
  const manifest=JSON.parse(files.get("manifest.json")!.toString());assert.equal(manifest.name,"romdex-status-acceptance");assert.equal(manifest.widgets.length,1);assert.ok(files.has("fault.js"));assert.equal(manifest.version,acceptanceVersion);assert.ok(files.has("widgets/acceptance/panel.js"));
  for(const widget of manifest.widgets){assert.ok(files.has("widgets/"+widget.indexPath),"widget index resolves relative to widgets/");}
  assert.ok(files.get("widgets/acceptance/index.html")!.toString().includes('src="panel.js"'));assert.ok(!files.has("acceptance/index.html"));
  assert.deepEqual(files.get("entity-extensions.json"),readFileSync("youtrack-app/entity-extensions.json"));
  for(const name of ["status-record.js","status-rules.js"]){
    const source=files.get(name)!.toString();assert.ok(!source.includes("module.exports"));
    assert.equal(source,readFileSync("youtrack-app/"+name,"utf8").replace("module.exports = {","Object.assign(exports, {").replace(/};\s*$/,"});\n"));
    const exported={};runInNewContext(source,{exports:exported},{filename:name});assert.ok(Object.keys(exported).length>0);
  }
  const exported:{httpHandler?:{endpoints:{scope:string;method:string;handle:(ctx:unknown)=>void}[]}}={};
  const require=createRequire(new URL("../../youtrack-app/status.js",import.meta.url));
  new Function("require","exports",files.get("status.js")!.toString())(require,exported);
  const endpoints=exported.httpHandler!.endpoints;
  for(const [id,summary,project,expected] of [["NPCD-872","[ROMDex acceptance] Root","NPCD",200],["NPCD-873","[ROMDex acceptance] Child","NPCD",200],["NPCD-874","[ROMDex acceptance] Other","NPCD",403],["NPCD-872","Existing NPCD task","NPCD",403],["PMON-1","[ROMDex acceptance] Root","PMON",403]]){
    let result:unknown;const response={code:200,addHeader:()=>{},json:(value:unknown)=>{result=value;}};
    const issue={id,summary,updated:1,isReported:true,isVisibleTo:()=>true,project:{shortName:project,canBeReadBy:()=>true,findFieldByName:()=>({typeName:"state[1]",isVisibleInIssue:()=>true})},fields:{State:{name:"Open"}},extensionProperties:{assignedStatus:null}};
    endpoints.find(entry=>entry.scope==="issue"&&entry.method==="GET")!.handle({issue,currentUser:{},response});
    assert.equal(response.code,expected,id+" guard");assert.ok(result);
  }
  assert.throws(()=>execFileSync(process.execPath,["scripts/package-youtrack.mjs","--acceptance","PMON"],{stdio:"pipe"}));
});

test("HTTP modules never mix global and project entity scopes",()=>{
  const require=createRequire(import.meta.url);
  for(const name of ["status","capabilities"]){const endpoints=require("../../youtrack-app/"+name+".js").httpHandler.endpoints as {scope:string}[];const families=new Set(endpoints.map(endpoint=>["global","user"].includes(endpoint.scope)?"global":"project"));assert.equal(families.size,1,name+" scope family");}
});

test("live rollback acceptance cannot pass on an early permission failure or a changed snapshot",async()=>{
  const source=readFileSync("youtrack-acceptance/panel.js","utf8").replace(/^const host = await YTApp.register\(\);\r?\n/,"");
  for(const kind of ["permission","changed","intended"]){
    const output={textContent:"",onclick:()=>{}},buttons=[{disabled:false}],snapshot={schema:1,id:"NPCD-872",initialized:true,revision:1,state:"Done",assignedState:"In Progress",updated:1};let after=false;
    const host={fetchApp:async(path:string)=>{if(path==="status/assigned")return {...snapshot,...(kind==="changed"&&after?{state:"Open"}:{})};after=true;throw {status:kind==="permission"?403:500,message:kind==="permission"?"Forbidden":"ROMDex acceptance forced rollback"};}};
    const panel=new Function("host","document","crypto",source+";return {rollback};")(host,{getElementById:()=>output,querySelectorAll:()=>buttons},crypto) as {rollback:()=>Promise<void>};
    if(kind==="intended")await panel.rollback();else await assert.rejects(panel.rollback(),kind==="permission"?/intended post-mutation exception/:/unchanged/);
  }
});


test("the selected live test button refuses incompatible capabilities before any issue request and displays the failure",async()=>{
  const source=readFileSync("youtrack-acceptance/panel.js","utf8").replace(/^const host = await YTApp.register\(\);\r?\n/,"");
  const valid={app:"romdex-status-acceptance",project:"NPCD",schema:1,statusRules:4};
  for(const patch of [{app:"romdex-status"},{project:"PMON"},{schema:2},{statusRules:2},{statusRules:3}]){
    const output={textContent:""},read={disabled:false,onclick:async()=>{}},run={disabled:false,onclick:async()=>{}},rollback={disabled:false,onclick:async()=>{}};
    const requests:string[]=[];
    const host={fetchApp:async(path:string)=>{requests.push(path);assert.equal(path,"capabilities/check");return {...valid,...patch};}};
    const elements={result:output,read,run,rollback};
    new Function("host","document","crypto",source)(host,{getElementById:(id:keyof typeof elements)=>elements[id],querySelectorAll:()=>[read,run,rollback]},crypto);
    assert.equal(output.textContent,"Ready. No request is sent until you choose a test.");assert.deepEqual(requests,[]);
    await run.onclick();
    assert.deepEqual(requests,["capabilities/check"]);assert.equal(output.textContent,"FAIL test app identity, protocol and status rules 4\n");
    for(const button of [read,run,rollback])assert.equal(button.disabled,false);
  }
});


test("the Run button supplies explicit global Host API options and stops at a failed metadata GET",async()=>{
  const source=readFileSync("youtrack-acceptance/panel.js","utf8").replace(/^const host = await YTApp.register\(\);\r?\n/,"");
  const output={textContent:""},read={disabled:false,onclick:async()=>{}},run={disabled:false,onclick:async()=>{}},rollback={disabled:false,onclick:async()=>{}};
  const requests:string[]=[];
  const host={fetchApp:async(path:string,options:{scope:boolean;method?:string})=>{assert.ok(options,"the deployed SDK reads options.scope");requests.push(path);if(path==="capabilities/check"){assert.deepEqual(options,{scope:false});return {app:"romdex-status-acceptance",project:"NPCD",schema:1,statusRules:4};}assert.deepEqual(options,{scope:true});throw Error("synthetic metadata failure");}};
  const elements={result:output,read,run,rollback};
  new Function("host","document","crypto",source)(host,{getElementById:(id:keyof typeof elements)=>elements[id],querySelectorAll:()=>[read,run,rollback]},crypto);
  await run.onclick();assert.deepEqual(requests,["capabilities/check","status/assigned"]);
  assert.equal(output.textContent,"PASS test app identity, protocol and status rules 4\nFAIL synthetic metadata failure\n");
  for(const button of [read,run,rollback])assert.equal(button.disabled,false);
});
