import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {STATES,rollup,indexTree,statusOf} from "../../src/domain/accepted/core.mjs";
import type {LampColor,TaskItem} from "../../src/domain/types";
import {sharedBackend} from "./shared-status-fixture";
const require=createRequire(import.meta.url),records=require("../../youtrack-app/status-record.js"),rules=require("../../youtrack-app/status-rules.js");
const root="PMON-900001",child="PMON-900002",leaf="PMON-900003";
const item=(id:string,state:string,parentId:string|null=null):TaskItem=>({id,summary:id,description:"",state,assignedState:state,parentId,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});

test("Standby rolls up only from at least two all-Standby immediate children",()=>{
 assert.equal(rollup([]),null);assert.equal(statusOf("Standby"),"blue");assert.equal(statusOf("Prompt Ready"),"blue");
 const cases:Array<[LampColor[],LampColor]>=[[["blue"],"yellow"],[["blue","blue"],"blue"],[["blue","blue","blue"],"blue"],[["blue","green"],"yellow"],[["blue","grey"],"yellow"],[["blue","yellow"],"yellow"],[["blue","purple"],"purple"],[["blue","red"],"red"],[["blue","amber"],"amber"],[["green","green"],"green"],[["grey","grey"],"grey"]];
 for(const [colors,expected] of cases){assert.equal(rollup(colors),expected);assert.equal(rules.rollup(colors),expected);}
 const colors=Object.keys(STATES) as LampColor[];
 for(const a of colors)for(const b of colors)for(const c of colors){assert.equal(rollup([a,b,c])==="blue",[a,b,c].every(x=>x==="blue"));assert.equal(rules.rollup([a,b,c]),rollup([a,b,c]));}
 const tasks=[item(root,"Standby"),item(child,"Standby",root),item(leaf,"Prompt Ready",child)];
 const tree=indexTree(tasks);assert.equal(tree.colors.get(root),"yellow");assert.equal(tree.colors.get(child),"yellow");assert.equal(tree.colors.get(leaf),"blue");assert.equal(tasks[0]?.assignedState,"Standby");assert.equal(indexTree([tasks[0]!]).colors.get(root),"blue");
});

test("shared rollups reject inherited Standby and retain assignments through nested In Progress delivery",()=>{
 const backend=sharedBackend([item(root,"Standby"),item(child,"Standby",root),item(leaf,"Standby",child)]);
 const write=(id:string,value:string)=>backend.call(id,"POST",{schema:1,opId:crypto.randomUUID(),kind:"rollup",value,expected:records.base(backend.call(id,"GET").body)});
 assert.equal(write(child,"Standby").status,409);assert.equal(backend.tasks.get(child)?.metadata,undefined);
 for(const id of [child,root]){assert.equal(write(id,"In Progress").status,200);const read=backend.call(id,"GET").body as {state:string;assignedState:string};assert.equal(read.state,"In Progress");assert.equal(read.assignedState,"Standby");}
 assert.equal(backend.tasks.get(leaf)?.state,"Standby");
});

test("the shared handler switches Standby at the two-child threshold and retains own assignment",()=>{
 const second="PMON-900004";
 const backend=sharedBackend([item(root,"In Development"),item(child,"Standby",root),item(second,"Prompt Ready",root)]);
 const write=(value:string)=>backend.call(root,"POST",{schema:1,opId:crypto.randomUUID(),kind:"rollup",value,expected:records.base(backend.call(root,"GET").body)});
 assert.equal(write("In Progress").status,409);assert.equal(write("Standby").status,200);
 const result=backend.call(root,"GET").body as {state:string;assignedState:string};assert.equal(result.state,"Standby");assert.equal(result.assignedState,"In Development");
 backend.tasks.get(second)!.parentId=null;assert.equal(write("Standby").status,409);assert.equal(write("In Progress").status,200);
 backend.tasks.get(second)!.parentId=root;backend.tasks.get(second)!.state="Done";assert.equal(write("Standby").status,409);
});
