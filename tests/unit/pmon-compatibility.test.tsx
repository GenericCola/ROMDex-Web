import assert from "node:assert/strict";
import {test} from "node:test";
import {createRequire} from "node:module";
import {rollup,indexTree,STATES,youTrackState,statusOf} from "../../src/domain/accepted/core.mjs";
import {issueBody} from "../../src/youtrack/issue-body";
import {matchesCreation} from "../../src/cloud/creation";
import {readRollupTree} from "../../src/cloud/rollup-tree";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import type {TaskItem,LampColor} from "../../src/domain/types";
import type {DeliveryPort} from "../../src/cloud/types";
import {sharedBackend} from "./shared-status-fixture";
const require=createRequire(import.meta.url),records=require("../../youtrack-app/status-record.js");
const root="PMON-900001",child="PMON-900002",other="PMON-900003",grand="PMON-900004";
const item=(id:string,state:string,parentId:string|null=null):TaskItem=>({id,summary:id,description:"",state,assignedState:state,parentId,priority:"Major",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});

test("PMON testing aliases use the existing State and every mixed parent displays amber",()=>{
  assert.equal(youTrackState("Awaiting Testing"),"Needs Testing");assert.equal(youTrackState("Needs Testing"),"Needs Testing");assert.equal(youTrackState("In Development"),"In Development");
  assert.equal(statusOf("Needs Testing"),"amber");
  const colors=Object.keys(STATES) as LampColor[];
  for(const a of colors)for(const b of colors)for(const c of colors)if([a,b,c].includes("amber"))assert.equal(rollup([a,b,c]),"amber");
  const tree=indexTree([item(grand,"To do"),item(root,"To do",grand),item(child,"Needs Testing",root),item(other,"Critical / Debugging",root)]);
  assert.equal(tree.colors.get(root),"amber");assert.equal(tree.colors.get(grand),"amber");
});

test("native testing payloads and creation readback map the label without changing other properties",()=>{
  const fields=[{id:"1-1",name:"State",$type:"StateIssueCustomField"}];
  assert.deepEqual(issueBody({state:"Awaiting Testing"},fields),{customFields:[{id:"1-1",name:"State",$type:"StateIssueCustomField",value:{name:"Needs Testing"}}]});
  const desired=item("local-fixture","Awaiting Testing"),remote={...desired,id:child,state:"Needs Testing",assignedState:"Needs Testing"};
  assert.equal(matchesCreation(desired,remote),true);assert.equal(matchesCreation(desired,{...remote,state:"In Development"}),false);
});

test("a native Needs Testing leaf never schedules a spurious write and legacy labels converge once",async()=>{
  const data=emptyWorkspace(),native=item(child,"Needs Testing");data.remote=[native];
  const port={accountId:"fixture",all:async()=>[native],children:async()=>[]} as unknown as DeliveryPort;
  assert.equal((await readRollupTree(data,port)).next,undefined);
  data.remote=[{...native,assignedState:"Awaiting Testing"}];data.cloud={...data.cloud,assigned:{[child]:{assignedState:"Awaiting Testing",lastState:"Needs Testing",lastUpdated:1,pendingState:null}},accountId:"fixture",automaticSyncEnabled:false,records:{}};
  const tree=await readRollupTree(data,port);assert.equal(tree.desired(tree.items[0]!),"Needs Testing");assert.equal(tree.next,undefined);
});

test("the shared app stores the display assignment but rolls parents into PMON Needs Testing",()=>{
  const backend=sharedBackend([item(grand,"To do"),item(root,"To do",grand),item(child,"To do",root),item(other,"Critical / Debugging",root)]);
  const write=(id:string,kind:string,value:string)=>backend.call(id,"POST",{schema:1,opId:crypto.randomUUID(),kind,value,expected:records.base(backend.call(id,"GET").body)});
  assert.equal(write(child,"assign","Awaiting Testing").status,200);
  for(const id of [child,root,grand])assert.equal(write(id,"rollup","Needs Testing").status,200);
  for(const id of [root,grand]){const result=backend.call(id,"GET").body as {state:string;assignedState:string};assert.equal(result.state,"Needs Testing");assert.equal(result.assignedState,"To do");}
  assert.equal(backend.tasks.get(child)?.state,"Needs Testing");
});

test("the web client rejects older status rules before reading issue metadata",async()=>{
  const {SharedStatusClient}=await import("../../src/youtrack/shared-status-client");
  const calls:string[]=[];
  for(const statusRules of [undefined,1,2,3]){
    calls.length=0;const legacy=new SharedStatusClient(async path=>{calls.push(path);return {schema:1,app:"romdex-status",project:"PMON",statusRules};});
    await assert.rejects(legacy.get(root),/unavailable or incompatible/);
    assert.deepEqual(calls,["extensionEndpoints/romdex-status/capabilities/check"]);
  }
});
