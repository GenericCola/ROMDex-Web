import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {STATES,rollup,indexTree,statusOf} from "../../src/domain/accepted/core.mjs";
import type {LampColor,TaskItem} from "../../src/domain/types";
import {sharedBackend} from "./shared-status-fixture";
const require=createRequire(import.meta.url),records=require("../../youtrack-app/status-record.js"),rules=require("../../youtrack-app/status-rules.js");
const root="PMON-900001",child="PMON-900002",leaf="PMON-900003";
const item=(id:string,state:string,parentId:string|null=null):TaskItem=>({id,summary:id,description:"",state,assignedState:state,parentId,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});

test("Standby is a leaf assignment and never a child-derived parent status",()=>{
 assert.equal(rollup([]),null);assert.equal(statusOf("Standby"),"blue");assert.equal(statusOf("Prompt Ready"),"blue");
 const cases:Array<[LampColor[],LampColor]>=[[["blue"],"yellow"],[["blue","blue"],"yellow"],[["blue","green"],"yellow"],[["blue","grey"],"yellow"],[["blue","yellow"],"yellow"],[["blue","purple"],"purple"],[["blue","red"],"red"],[["blue","amber"],"amber"],[["green","green"],"green"],[["grey","grey"],"grey"]];
 for(const [colors,expected] of cases){assert.equal(rollup(colors),expected);assert.equal(rules.rollup(colors),expected);}
 const colors=Object.keys(STATES) as LampColor[];
 for(const a of colors)for(const b of colors)for(const c of colors){assert.notEqual(rollup([a,b,c]),"blue");assert.equal(rules.rollup([a,b,c]),rollup([a,b,c]));}
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