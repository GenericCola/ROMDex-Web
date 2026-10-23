import test from "node:test";
import assert from "node:assert/strict";
import {createBackend,mountPanel,archiveFiles} from "./fixture.mjs";

test("complete packaged root sequence uses exact receipts, read-only GET, replay and 409 concurrency; reload persists",async()=>{
 const server=createBackend(),panel=await mountPanel(server);
 assert.equal(panel.nodes.result.textContent,"Ready. No request is sent until you choose a test.");
 assert.equal(server.requests.length,0);
 await panel.click("read");assert.equal(server.commits.length,0);
 const output=await panel.click("run");assert.ok(!output.includes("FAIL"),output);assert.match(output,/exact receipt and HTTP 409 loser/);
 assert.equal(server.tasks.get("NPCD-872").state,"Done");assert.equal(server.tasks.get("NPCD-873").state,"Done");
 const stored=structuredClone(server.tasks),reopened=await mountPanel(server);await reopened.click("read");assert.deepEqual(server.tasks,stored);
});
test("leaf sequence completes, then root precondition stops before any write until child is restored",async()=>{
 const server=createBackend();const child=await mountPanel(server,{id:"NPCD-873"});
 const output=await child.click("run");assert.ok(!output.includes("FAIL"),output);
 const root=await mountPanel(server),before=server.commits.length;
 assert.match(await root.click("run"),/FAIL root test requires the child fixture restored to Done/);
 assert.equal(server.commits.length,before);
});
test("rollback handles the native empty exception body without falsely passing its marker",async()=>{
 const server=createBackend(),panel=await mountPanel(server);await panel.click("run");
 const before=structuredClone(server.tasks),output=await panel.click("rollback");
 assert.match(output,/PASS failed request left metadata, State and timestamp unchanged/);
 assert.match(output,/PENDING verify this exact post-mutation marker/);assert.ok(!output.includes("FAIL"),output);
 assert.deepEqual(server.tasks,before);
 const marker=server.logs.find((line)=>line.startsWith("ROMDex acceptance forced rollback "));
 assert.ok(marker);assert.ok(output.includes(marker));
 assert.equal(server.dispatch("fault/rollback",{scope:true,method:"POST",body:{} }).status,400);
});
test("uninitialized rollback refuses before any mutation or marker",async()=>{
 const server=createBackend(),panel=await mountPanel(server),before=structuredClone(server.tasks);
 assert.match(await panel.click("rollback"),/FAIL rollback starts/);assert.deepEqual(server.tasks,before);assert.equal(server.logs.length,0);
});
test("registration failure renders a readable error and leaves all mutation controls disabled",async()=>{
 const server=createBackend(),panel=await mountPanel(server,{registerError:Error("SDK unavailable")});
 assert.match(panel.nodes.result.textContent,/FAIL widget registration: SDK unavailable/);
 for(const key of ["read","run","rollback"])assert.equal(panel.nodes[key].disabled,true);
 assert.equal(server.requests.length,0);
 assert.match(archiveFiles.get("widgets/acceptance/index.html"),/id="run" disabled/);
});
test("all selected controls refuse incompatible capabilities before any issue access",async()=>{
 for(const key of ["read","run","rollback"])for(const patch of [{app:"wrong"},{project:"PMON"},{schema:2},{statusRules:3},null]){
  const server=createBackend(),host=server.host();host.fetchApp=async(path,options)=>{assert.equal(path,"capabilities/check");assert.deepEqual(options,{scope:false});return patch?{app:"romdex-status-acceptance",project:"NPCD",schema:1,statusRules:4,...patch}:null;};
  const panel=await mountPanel(server,{host});assert.match(await panel.click(key),/FAIL test app identity/);assert.equal(server.requests.length,0);
  for(const name of ["read","run","rollback"])assert.equal(panel.nodes[name].disabled,false);
 }
});
test("null, string and empty HTTP failures render safely and always unlock",async()=>{
 for(const failure of [null,"network lost",{status:500,message:""},{status:403},{message:"metadata failed"},{message:500}]){
  const server=createBackend(),host=server.host(),original=host.fetchApp;
  host.fetchApp=async(path,options)=>{if(path==="capabilities/check")return original(path,options);throw failure;};
  const panel=await mountPanel(server,{host}),output=await panel.click("read");assert.match(output,/FAIL/);assert.ok(!output.includes("undefined"),output);
  assert.equal(server.commits.length,0);for(const key of ["read","run","rollback"])assert.equal(panel.nodes[key].disabled,false);
 }
});
test("a concurrency loser with HTTP 500 cannot count as a CAS pass",async()=>{
 const server=createBackend(),host=server.host(),original=host.fetchApp;
 host.fetchApp=async(path,options)=>{try{return await original(path,options);}catch(error){if(error.status===409&&options.body?.kind==="assign"&&server.commits.length>=3)throw {status:500};throw error;}};
 const panel=await mountPanel(server,{host}),output=await panel.click("run");
 assert.match(output,/FAIL same-revision concurrent requests/);
});
test("archive backend refuses permission, field and malformed storage failures without commits",()=>{
 for(const kind of ["readable","writable","fieldReadable","fieldVisible","fieldType","missingState","corrupt"]){
  const s=createBackend(),before=structuredClone(s.tasks);
  if(kind==="corrupt")s.tasks.get("NPCD-872").metadata="{bad";else if(kind==="fieldType")s.options.fieldType="enum[1]";else s.options[kind]=kind==="missingState";
  const snapshot=s.dispatch("status/assigned",{scope:true}).body;
  const result=s.dispatch("status/assigned",{scope:true,method:"POST",body:{schema:1,opId:"sample",kind:"assign",value:"In Progress",expected:snapshot}});
  assert.ok(result.status>=400,kind);assert.equal(s.commits.length,0);assert.equal(s.tasks.get("NPCD-872").state,before.get("NPCD-872").state);
 }
});
test("an unexpected workflow failure escapes and cannot commit either half in the transaction stand-in",()=>{
 const s=createBackend(),read=()=>s.dispatch("status/assigned",{scope:true}).body;
 const body={schema:1,opId:"workflow",kind:"rollup",value:"Done",expected:read()},before=structuredClone(s.tasks);s.options.throwAfterState=true;
 const result=s.dispatch("status/assigned",{scope:true,method:"POST",body});assert.equal(result.status,500);assert.match(result.error.message,/workflow/);assert.deepEqual(s.tasks,before);
});

test("malformed or wrong-identity snapshots cannot pass the Read control or start a write",async()=>{
 for(const patch of [{id:"PMON-1"},{revision:-1},{updated:-1},{initialized:true},{receipt:{}},{state:undefined}]){
  const server=createBackend(),host=server.host(),original=host.fetchApp;
  host.fetchApp=async(path,options)=>{const value=await original(path,options);return path==="status/assigned"?{...value,...patch}:value;};
  const panel=await mountPanel(server,{host});assert.match(await panel.click("read"),/FAIL allowlisted live fixture and protocol/);assert.equal(server.commits.length,0);
 }
});
test("a second action cannot overlap an outstanding request",async()=>{
 const server=createBackend(),host=server.host(),original=host.fetchApp;let release;const held=new Promise((resolve)=>{release=resolve;});
 host.fetchApp=async(path,options)=>{if(path==="capabilities/check")await held;return original(path,options);};
 const panel=await mountPanel(server,{host}),first=panel.nodes.read.onclick();
 for(const key of ["read","run","rollback"])assert.equal(panel.nodes[key].disabled,true);
 await panel.nodes.run.onclick();release();await first;assert.equal(server.requests.filter((request)=>request.path==="capabilities/check").length,1);assert.equal(server.commits.length,0);
});

test("an accepted assignment with a lost response is not automatically resent and remains readable after reopening",async()=>{
 const server=createBackend(),host=server.host(),original=host.fetchApp;let lost=false;
 host.fetchApp=async(path,options)=>{const value=await original(path,options);if(!lost&&options.method==="POST"){lost=true;throw {status:500,message:""};}return value;};
 const panel=await mountPanel(server,{host});assert.match(await panel.click("run"),/FAIL HTTP 500:/);assert.equal(server.commits.length,1);assert.equal(server.requests.filter((request)=>request.method==="POST").length,1);
 const before=structuredClone(server.tasks),reopened=await mountPanel(server);assert.match(await reopened.click("read"),/"assignedState": "In Progress"/);assert.deepEqual(server.tasks,before);
});
test("rollback cannot pass after either mutation persists or when the server reports success",async()=>{
 for(const kind of ["changed","success"]){
  const server=createBackend(),host=server.host(),original=host.fetchApp,panel=await mountPanel(server,{host});await panel.click("run");
  host.fetchApp=async(path,options)=>{if(path==="fault/rollback"){if(kind==="changed"){server.tasks.get("NPCD-872").state="Open";throw {status:500};}return {};}return original(path,options);};
  assert.match(await panel.click("rollback"),kind==="changed"?/FAIL failed request left metadata, State and timestamp unchanged/:/FAIL rollback request returned a server failure/);
 }
});
